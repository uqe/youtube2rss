export const getYoutubeVideoId = (message: string) => {
  const regex =
    /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;

  const res = regex.exec(message);

  return res && res[1];
};

export const isS3Configured = () => {
  return Boolean(
    Deno.env.get("S3_ENDPOINT") &&
      Deno.env.get("S3_BUCKET") &&
      Deno.env.get("S3_ACCESS_KEY") &&
      Deno.env.get("S3_SECRET_KEY"),
  );
};
