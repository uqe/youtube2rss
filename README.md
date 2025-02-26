# `youtube2rss`

This Telegram bot allows you to turn YouTube videos into podcast feed that you can listen to in your favorite podcast app. Simply send a YouTube link to the bot and it will download the video, extract the audio, and generate an RSS feed that you can host on your server or use S3 storage.

The bot is built using `Bun` and uses the [youtube-dl-exec](https://www.npmjs.com/package/) library to download and extract the audio from the YouTube videos. It also uses the [podcast](https://www.npmjs.com/package/podcast) library to generate the RSS feed.

To use the bot, you'll need to set up a Telegram bot and get an API token. You'll also need to have `Bun` and `Node.js` installed.

## Installation

1. Clone this repository:

   ```sh
   git clone https://github.com/uqe/youtube2rss
   ```

2. Install dependencies:

   ```sh
   bun install
   ```

3. Create SQLite database:

   ```sh
   bun run prepare
   ```

4. Create the `.env` or `.env.dev` file with your Telegram bot token and Server URL (**both are required**) like in the `.env.example` file.

5. Start a Teleram bot (**production**):

   ```sh
   bun run start
   ```

   or in **development** mode:

   ```sh
   bun run start:dev
   ```

## How to use

1. Start a chat with your bot in Telegram.

2. Send the bot a YouTube link.

3. The bot will download the video, extract the audio, and generate an RSS feed.

4. Host the RSS feed on your server and subscribe to it in your favorite podcast app.

## Bun static file server usage (optional)

1. Start the static file server (**production**):

   ```sh
   bun run serve
   ```

   or **development** mode:

   ```sh
   bun run serve:dev
   ```

## S3 file storage usage (optional)

1. Fill env variables: `TELEGRAM_BOT_TOKEN`, `SERVER_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_ENDPOINT` and `S3_SECRET_KEY` in the `.env` or `.env.dev` file.

If all variables are set, the bot will store `.mp3` files and generated `rss.xml` file in your S3 bucket. I'm using [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) as S3 compatible storage. The [free plan](https://developers.cloudflare.com/r2/pricing/) is sufficient for my needs.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## TODO list

- [x] Update README
- [ ] Add pm2
- [ ] Better logging
- [ ] Add thumbnails podcast episodes
- [ ] Parse timestamps in video description and add them to the podcast feed
