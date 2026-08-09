import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

export interface EpisodeChapter {
  startTime: number;
  endTime?: number;
  title: string;
}

export interface EpisodeChaptersDocument {
  version: "1.2.0";
  chapters: EpisodeChapter[];
}

interface YoutubeChapter {
  start_time?: unknown;
  end_time?: unknown;
  title?: unknown;
}

const getFiniteNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const normalizeChapter = (chapter: unknown): EpisodeChapter | null => {
  if (!chapter || typeof chapter !== "object") {
    return null;
  }

  const source = chapter as YoutubeChapter;
  const startTime = getFiniteNumber(source.start_time);
  const endTime = getFiniteNumber(source.end_time);
  const title = typeof source.title === "string" ? source.title.trim() : "";

  if (startTime === undefined || startTime < 0 || !title) {
    return null;
  }

  return {
    startTime,
    ...(endTime !== undefined && endTime > startTime ? { endTime } : {}),
    title,
  };
};

export const createEpisodeChaptersDocument = (videoInfo: unknown): EpisodeChaptersDocument | null => {
  if (!videoInfo || typeof videoInfo !== "object") {
    return null;
  }

  const sourceChapters = (videoInfo as { chapters?: unknown }).chapters;
  if (!Array.isArray(sourceChapters)) {
    return null;
  }

  const chapters = sourceChapters
    .map(normalizeChapter)
    .filter((chapter): chapter is EpisodeChapter => chapter !== null)
    .toSorted((left, right) => left.startTime - right.startTime);

  return chapters.length > 0 ? { version: "1.2.0", chapters } : null;
};

const deleteFile = async (filePath: string) => {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    await file.delete();
  }
};

export const writeEpisodeChapters = async (videoInfo: unknown, outputPath: string): Promise<boolean> => {
  const document = createEpisodeChaptersDocument(videoInfo);
  if (!document) {
    await deleteFile(outputPath);
    return false;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${crypto.randomUUID()}.tmp`;

  try {
    await Bun.write(temporaryPath, `${JSON.stringify(document, null, 2)}\n`);
    await rename(temporaryPath, outputPath);
    return true;
  } finally {
    await deleteFile(temporaryPath);
  }
};
