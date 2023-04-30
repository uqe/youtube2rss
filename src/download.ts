import { Message } from "https://deno.land/x/grammy_types@v3.0.3/message.ts";
import ytdl, { getInfo } from "https://deno.land/x/ytdl_core/mod.ts";
import { convertVideo } from "./convert-video.ts";
import { isVideoExists } from "./db.ts";

const download = async (videoId: string, handler?: (text: string) => Promise<Message.TextMessage>) => {
  try {
    const info = await getInfo(videoId);

    if (isVideoExists(info.videoDetails.videoId)) {
      console.log("Video already exists");
      handler && handler("Video already exists. Find it in the RSS feed.");
      return;
    }

    const stream = await ytdl(videoId, { filter: "audioonly" });

    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const blob = new Blob(chunks);

    await Deno.writeFile(`./public/files/${info.videoDetails.videoId}.mp4`, new Uint8Array(await blob.arrayBuffer()));

    convertVideo(info, handler);
  } catch (error) {
    handler && handler("Something went wrong. Please try again later...");
    console.error(error);
  }
};

export { download };
