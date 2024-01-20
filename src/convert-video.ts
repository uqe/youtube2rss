import { exists, FfmpegClass, Message, VideoInfo } from "./deps.ts";
import { getFilePath, updateDb } from "./helpers.ts";

export const convertVideo = async (info: VideoInfo, handler?: (text: string) => Promise<Message.TextMessage>) => {
  const { videoId } = info.videoDetails;

  const ffmpeg = new FfmpegClass({
    input: getFilePath(videoId, "mp4"),
    ffmpegDir: "ffmpeg",
  });

  console.log("Conversion started");

  try {
    await ffmpeg.audioBitrate(128).save(getFilePath(videoId, "mp3"));
    console.log("Conversion ended successfully");
    !Deno.env.get("IS_TEST") && (await updateDb(info));

    if ((await exists(getFilePath(videoId, "mp4"))) && !Deno.env.get("IS_TEST")) {
      Deno.remove(getFilePath(videoId, "mp4"));
    }

    return true;
  } catch (error) {
    handler && handler(`Error converting video ${videoId}`);
    console.error(error);
  }
};
