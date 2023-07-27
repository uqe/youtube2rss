import { S3Client } from "./deps.ts";

const s3client = new S3Client({
  endPoint: Deno.env.get("S3_ENDPOINT") || "temporary-endpoint",
  port: 443,
  useSSL: true,
  region: "auto",
  bucket: Deno.env.get("S3_BUCKET"),
  pathStyle: false,
  accessKey: Deno.env.get("S3_ACCESS_KEY"),
  secretKey: Deno.env.get("S3_SECRET_KEY"),
});

export const putFileOnS3 = async (videoId: string, filePath: string) => {
  const file = await Deno.open(filePath, { read: true });

  const readableStream = file.readable;

  await s3client.putObject(`files/${videoId}.mp3`, readableStream);
};

export const uploadXmlToS3 = async (filePath: string) => {
  const file = await Deno.open(filePath, { read: true });

  const readableStream = file.readable;

  await s3client.putObject(`rss.xml`, readableStream, {
    metadata: {
      "Content-Type": "text/xml",
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    },
  });
};
