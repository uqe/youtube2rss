type LogLevel = "debug" | "info" | "warn" | "error" | "success";

interface StructuredLogEvent {
  event: string;
  videoId?: string;
  stage?: string;
  error?: string;
}

interface LoggerOptions {
  now?: () => Date;
  write?: (level: LogLevel, line: string) => void;
  useColors?: boolean;
}

const eventMessages: Record<string, string> = {
  video_already_published: "Video already published",
  feed_publication_retry: "Retrying RSS publication",
  feed_publication_recovered: "RSS publication recovered",
  video_download_started: "Download started",
  video_download_completed: "Download completed",
  downloaded_file_invalid: "Downloaded file is invalid",
  feed_publication_started: "Publishing RSS",
  feed_publication_completed: "RSS published",
  download_cleanup_failed: "Download cleanup failed",
  video_processing_failed: "Video processing failed",
  download_notification_failed: "Download notification failed",
};

const levelLabels: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  success: "DONE",
};

const levelColors: Record<LogLevel, number> = {
  debug: 90,
  info: 36,
  warn: 33,
  error: 31,
  success: 32,
};

const timestampFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const parseStructuredEvent = (message: string): StructuredLogEvent | null => {
  if (!message.startsWith("{")) {
    return null;
  }

  try {
    const value = JSON.parse(message) as unknown;
    if (typeof value !== "object" || value === null || !("event" in value) || typeof value.event !== "string") {
      return null;
    }
    return value as StructuredLogEvent;
  } catch {
    return null;
  }
};

export const formatLogMessage = (message: string) => {
  const event = parseStructuredEvent(message);
  if (!event) {
    return message;
  }

  const text = eventMessages[event.event] ?? event.event.replaceAll("_", " ");
  const context = [
    event.videoId ? `video=${event.videoId}` : null,
    event.error ? `stage=${event.stage ?? "unknown"}` : null,
    event.error ? `error=${event.error}` : null,
  ].filter((value): value is string => value !== null);

  return context.length > 0 ? `${text}  ${context.join("  ")}` : text;
};

const defaultWriter = (level: LogLevel, line: string) => {
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const createLogger = ({
  now = () => new Date(),
  write = defaultWriter,
  useColors = Boolean(process.stdout.isTTY) && Bun.env.NO_COLOR === undefined,
}: LoggerOptions = {}) => {
  const log = (level: LogLevel, message: string) => {
    const timestamp = timestampFormatter.format(now());
    const plainLabel = levelLabels[level].padEnd(5);
    const label = useColors ? `\u001B[${levelColors[level]}m${plainLabel}\u001B[0m` : plainLabel;
    write(level, `${timestamp}  ${label}  ${formatLogMessage(message)}`);
  };

  return {
    debug: (message: string) => log("debug", message),
    info: (message: string) => log("info", message),
    warn: (message: string) => log("warn", message),
    error: (message: string) => log("error", message),
    success: (message: string) => log("success", message),
  };
};

export const logger = createLogger();
