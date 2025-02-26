import { S3Client } from "bun";

const s3client = new S3Client({
  endpoint: Bun.env.S3_ENDPOINT || "undefined.com",
  bucket: Bun.env.S3_BUCKET,
  accessKeyId: Bun.env.S3_ACCESS_KEY,
  secretAccessKey: Bun.env.S3_SECRET_KEY,
});

export const uploadFileOnS3 = async (videoId: string, filePath: string) => {
  try {
    await s3client.write(`files/${videoId}.mp3`, Bun.file(filePath));
  } catch (error) {
    console.error(`Error putting file on S3: ${error}`);
  }
};

export const uploadXmlToS3 = async (filePath: string) => {
  try {
    await s3client.write(`rss.xml`, Bun.file(filePath));
  } catch (error) {
    console.error(`Error uploading XML to S3: ${error}`);
  }
};

export const isCoverImageExistsOnS3 = async () => {
  try {
    const isCoverExists = await s3client.exists(`cover.jpg`);

    if (!isCoverExists) {
      await s3client.write("cover.jpg", Bun.file("./public/cover.jpg"));
    }
  } catch (error) {
    console.error(`Error checking cover image on S3: ${error}`);
  }
};
