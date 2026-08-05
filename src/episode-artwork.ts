import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

const artworkSize = 1400;

export interface ArtworkProcessor {
  (sourcePath: string, outputPath: string): Promise<void>;
}

export interface DownloadEpisodeArtworkOptions {
  fetchThumbnail?: (input: URL) => Promise<Response>;
  processArtwork?: ArtworkProcessor;
}

const deleteFile = async (filePath: string) => {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    await file.delete();
  }
};

export const processEpisodeArtwork: ArtworkProcessor = async (sourcePath, outputPath) => {
  const background =
    `[0:v]scale=${artworkSize}:${artworkSize}:force_original_aspect_ratio=increase,` +
    `crop=${artworkSize}:${artworkSize},gblur=sigma=40[background]`;
  const foreground = `[0:v]scale=${artworkSize}:${artworkSize}:force_original_aspect_ratio=decrease[foreground]`;
  const filter = `${background};${foreground};[background][foreground]overlay=(W-w)/2:(H-h)/2,format=yuvj420p`;
  const process = Bun.spawn(
    [
      "ffmpeg",
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-filter_complex",
      filter,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputPath,
    ],
    { stdout: "ignore", stderr: "pipe" }
  );
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()]);

  if (exitCode !== 0) {
    throw new Error(`Failed to prepare episode artwork: ${stderr.trim() || `ffmpeg exited with ${exitCode}`}`);
  }
};

export const downloadEpisodeArtwork = async (
  thumbnailUrl: string,
  outputPath: string,
  { fetchThumbnail = fetch, processArtwork = processEpisodeArtwork }: DownloadEpisodeArtworkOptions = {}
) => {
  const url = new URL(thumbnailUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported thumbnail protocol: ${url.protocol}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryId = crypto.randomUUID();
  const sourcePath = `${outputPath}.${temporaryId}.source`;
  const preparedPath = `${outputPath}.${temporaryId}.jpg`;

  try {
    const response = await fetchThumbnail(url);
    if (!response.ok) {
      throw new Error(`Failed to download episode artwork: HTTP ${response.status}`);
    }

    await Bun.write(sourcePath, response);
    await processArtwork(sourcePath, preparedPath);

    const preparedFile = Bun.file(preparedPath);
    if (!(await preparedFile.exists()) || preparedFile.size === 0) {
      throw new Error("Prepared episode artwork is missing or empty");
    }

    await rename(preparedPath, outputPath);
  } finally {
    await Promise.all([deleteFile(sourcePath), deleteFile(preparedPath)]);
  }
};
