import { InlineKeyboard } from "grammy";
import type { Api, Bot } from "grammy";

import { collectionRepository } from "./collections.ts";
import type { CollectionRepository } from "./collections.ts";
import { getRequiredServerUrl } from "./config.ts";
import { getYoutubeVideoId, getYoutubeVideoUrl } from "./helpers.ts";
import { jobRepository } from "./jobs.ts";
import type { Job, JobRepository } from "./jobs.ts";

const stages: Record<string, string> = {
  queued: "В очереди",
  lookup: "Проверяю эпизод",
  download: "Скачиваю аудио",
  validate: "Проверяю файл",
  metadata: "Читаю описание",
  chapters: "Готовлю главы",
  artwork: "Готовлю обложку",
  "upload-audio": "Загружаю аудио в хранилище",
  "upload-artwork": "Загружаю обложку",
  "upload-chapters": "Загружаю главы",
  persist: "Сохраняю эпизод",
  "publish-feed": "Обновляю RSS",
  completed: "Готово",
  failed: "Не удалось завершить",
};
export const formatJobMessage = (job: Job): string => {
  const label =
    job.kind === "delete" ? "Удаление эпизода" : job.kind === "download" ? "Добавление эпизода" : "Обновление ленты";
  const detail =
    job.result === "failed"
      ? "Не удалось завершить. Нажми «Повторить»."
      : job.status === "completed"
        ? "Готово — RSS обновлён."
        : job.status === "queued" && job.attempts > 0
          ? "Временная ошибка. Повторю автоматически."
          : `${stages[job.progress.stage] ?? "Обработка"}${job.status === "processing" ? ` · ${job.progress.percent}%` : ""}`;
  return `${label}${job.videoId ? `: ${job.videoId}` : ""}\n${detail}`;
};
export const jobKeyboard = (job: Job, baseUrl: string) => {
  const keyboard = new InlineKeyboard();
  if (job.result === "failed") {
    keyboard.text("Повторить", `retry:${job.id}`).row();
  }
  if (job.videoId && job.kind !== "delete") {
    keyboard.url("Оригинал", getYoutubeVideoUrl(job.videoId));
    if (job.status === "completed" && job.result !== "failed" && job.videoId.length <= 11) {
      keyboard.text("В коллекцию", `choose:${job.videoId}`);
    }
    keyboard.row();
  }
  return keyboard.url("RSS", `${baseUrl}/${job.collectionId ? `feeds/${job.collectionId}.xml` : "rss.xml"}`);
};

export const createJobNotifier = (
  api: Pick<Api, "editMessageText">,
  jobs: JobRepository = jobRepository,
  baseUrl = getRequiredServerUrl(),
) => {
  let busy = false;
  let nextAttempt = 0;
  return async () => {
    if (busy || Date.now() < nextAttempt) {
      return;
    }
    busy = true;
    try {
      for (const message of jobs.messages()) {
        const text = formatJobMessage(message.job);
        const signature = JSON.stringify([text, message.job.status, message.job.result]);
        if (signature === message.signature) {
          continue;
        }
        try {
          await api.editMessageText(message.chatId, message.messageId, text, {
            reply_markup: jobKeyboard(message.job, baseUrl),
          });
          jobs.acknowledge(message, signature, message.job.status === "completed");
        } catch (error) {
          const failure = error as { error_code?: number; description?: string; parameters?: { retry_after?: number } };
          if (failure.error_code === 403 || /message to edit not found/i.test(failure.description ?? "")) {
            jobs.acknowledge(message, signature, true);
          } else if (/message is not modified/i.test(failure.description ?? "")) {
            jobs.acknowledge(message, signature, message.job.status === "completed");
          } else {
            nextAttempt = Date.now() + (failure.parameters?.retry_after ?? 5) * 1000;
            break;
          }
        }
      }
    } finally {
      busy = false;
    }
  };
};

export const installJobBotHandlers = (
  bot: Bot,
  whitelist: number[],
  {
    jobs = jobRepository,
    collections = collectionRepository,
    baseUrl = getRequiredServerUrl(),
  }: { jobs?: JobRepository; collections?: CollectionRepository; baseUrl?: string } = {},
) => {
  bot.use(async (ctx, next) => {
    if (!ctx.from || !whitelist.includes(ctx.from.id)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "Нет доступа" });
      } else {
        await ctx.reply("You are not allowed to use this bot...");
      }
      return;
    }
    await next();
  });
  bot.command("start", (ctx) =>
    ctx.reply(
      "Отправь ссылку на YouTube. /queue — очередь, /rss — подписка, /collections — коллекции, /collection Название — создать.",
    ),
  );
  bot.command("rss", (ctx) => ctx.reply(`${baseUrl}/rss.xml`));
  bot.command("queue", (ctx) => {
    const jobsToShow = jobs.list(10);
    return ctx.reply(jobsToShow.length ? jobsToShow.map(formatJobMessage).join("\n\n") : "Очередь пуста.");
  });
  bot.command("collections", async (ctx) => {
    const items = collections.list();
    await ctx.reply(
      items.length
        ? items.map((item) => `${item.name}\n${baseUrl}/feeds/${item.id}.xml`).join("\n\n")
        : "Коллекций пока нет. Создай: /collection Интервью",
    );
  });
  bot.command("collection", async (ctx) => {
    const name = ctx.match.trim();
    if (!name || name.length > 80) {
      await ctx.reply("Укажи название длиной до 80 символов: /collection Интервью");
      return;
    }
    const collection = collections.create(name);
    jobs.enqueue({ kind: "refresh" });
    await ctx.reply(
      `Коллекция «${collection.name}» создана. Лента появится после обработки очереди.\n${baseUrl}/feeds/${collection.id}.xml`,
    );
  });
  bot.callbackQuery(/^retry:([a-f0-9-]{36})$/, async (ctx) => {
    const job = jobs.retry(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: job ? "Добавлено в очередь" : "Повтор не требуется" });
    if (job && ctx.chat && ctx.callbackQuery.message) {
      jobs.subscribe(job.id, ctx.chat.id, ctx.callbackQuery.message.message_id);
    }
  });
  bot.callbackQuery(/^choose:([\w-]+)$/, async (ctx) => {
    const items = collections.list();
    await ctx.answerCallbackQuery();
    if (!items.length) {
      await ctx.reply("Сначала создай коллекцию: /collection Интервью");
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const item of items.slice(0, 30)) {
      keyboard.text(item.name, `collect:${ctx.match[1]}:${item.id}`).row();
    }
    await ctx.reply("Выбери коллекцию:", { reply_markup: keyboard });
  });
  bot.callbackQuery(/^collect:([\w-]+):([a-f0-9-]{36})$/, async (ctx) => {
    if (!collections.get(ctx.match[2])) {
      await ctx.answerCallbackQuery({ text: "Коллекция не найдена" });
      return;
    }
    const job = jobs.enqueue({ kind: "collection-add", videoId: ctx.match[1], collectionId: ctx.match[2] });
    await ctx.answerCallbackQuery({ text: "Добавлено в очередь" });
    const message = await ctx.reply(formatJobMessage(job));
    jobs.subscribe(job.id, message.chat.id, message.message_id);
  });
  bot.on("message:text", async (ctx) => {
    const videoId = getYoutubeVideoId(ctx.message.text);
    if (!videoId || videoId.length !== 11) {
      await ctx.reply("Пришли корректную ссылку на YouTube.");
      return;
    }
    const job = jobs.enqueue({ kind: "download", videoId });
    const message = await ctx.reply(formatJobMessage(job));
    jobs.subscribe(job.id, message.chat.id, message.message_id);
  });
};
