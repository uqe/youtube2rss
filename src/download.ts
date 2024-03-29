import { convertVideo } from "./convert-video.ts";
import { getAllVideos, isVideoExists } from "./db.ts";
import { getInfo, Message, ytdl } from "./deps.ts";
import { generateFeed } from "./generate-feed.ts";
import { getFilePath, isS3Configured } from "./helpers.ts";
import { uploadFileOnS3 } from "./s3.ts";

export const download = async (videoId: string, handler?: (text: string) => Promise<Message.TextMessage>) => {
  try {
    const info = await getInfo(videoId);

    if (isVideoExists(info.videoDetails.videoId)) {
      console.log("Video already exists");
      handler && handler("Video already exists. Find it in the RSS feed.");
      return;
    }

    console.log("Start downloading");

    const stream = await ytdl(videoId, { filter: "audioonly" });

    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const blob = new Blob(chunks);

    await Deno.writeFile(`./public/files/${info.videoDetails.videoId}.mp4`, new Uint8Array(await blob.arrayBuffer()));

    console.log("Downloaded successfully");

    await convertVideo(info, handler);

    if (isS3Configured() && !Deno.env.get("IS_TEST")) {
      await uploadFileOnS3(videoId, getFilePath(videoId, "mp3"));
    }

    console.log("Start regenerating RSS feed");
    generateFeed(getAllVideos());
    console.log("Feed regenerated successfully");
    handler && handler("RSS feed was successfully updated.");
  } catch (error) {
    handler && handler("Something went wrong. Please try again later...");
    console.error(error);
  }
};
