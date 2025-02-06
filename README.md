# `youtube2rss`

This Telegram bot allows you to turn YouTube videos into podcasts that you can listen to in your favorite podcast app. Simply send a YouTube link to the bot and it will download the video, extract the audio, and generate an RSS feed that you can host on your server.

The bot is built using `Deno`, a secure runtime for JavaScript and TypeScript, and uses the [ytdl-core](https://www.npmjs.com/package/ytdl-core) library to download and extract the audio from the YouTube video. It also uses the [podcast](https://www.npmjs.com/package/podcast) library to generate the RSS feed.

To use the bot, you'll need to set up a Telegram bot and get an API token. You'll also need to have `Deno` and `Node.js` installed on your machine.

## Installation

1. Clone this repository:

   ```sh
   git clone https://github.com/uqe/youtube2rss
   ```

2. Install dependencies:

   ```sh
   deno cache src/deps.ts --lock=deno.lock --lock-write
   ```

3. Make sure ffmpeg installed on your machine:

   ```sh
   ffmpeg -version
   ```

4. Create SQLite database:

   ```sh
   deno task prepare
   ```

5. Start a Teleram bot with this ENV variables: `TELEGRAM_BOT_TOKEN` and `SERVER_URL`, for example:

   ```sh
   TELEGRAM_BOT_TOKEN=myTeLeGrAmBoTtOkEn
   SERVER_URL=https://my-s3-bucket-public-url.com
   deno task telegram
   ```

## How to use

1. Start a chat with your bot in Telegram.

2. Send the bot a YouTube link.

3. The bot will download the video, extract the audio, and generate an RSS feed.

4. Host the RSS feed on your server and subscribe to it in your favorite podcast app.

## Deno static file server usage (optional)

1. Install dependencies:

   ```sh
   deno install --allow-net --allow-read https://deno.land/std@0.192.0/http/file_server.ts
   ```

2. Start the file server:

   ```sh
   deno task serve
   ```

## S3 file storage usage (optional)

1. Start a Teleram bot with this ENV variables: `TELEGRAM_BOT_TOKEN`, `SERVER_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_ENDPOINT` and `S3_SECRET_KEY`, for example:

```sh
TELEGRAM_BOT_TOKEN=myTeLeGrAmBoTtOkEn
SERVER_URL=https://my-s3-bucket-public-url.com
S3_BUCKET=youtube2rss
S3_ACCESS_KEY=s3AcCeSsKeY
S3_ENDPOINT=bucket.s3.com
S3_SECRET_KEY=s3SeCrEtKeY
deno task telegram
```

If all variables are set, the bot will store `.mp3` files and generated `rss.xml` file in your S3 bucket. I'm using [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) as S3 compatible storage. The [free plan](https://developers.cloudflare.com/r2/pricing/) is sufficient for my needs. Don't forget to manually upload `cover.jpg` to your bucket.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## TODO list

[] Update README
[] Add pm2
