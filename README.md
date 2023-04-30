# youtube2rss

This Telegram bot allows you to turn YouTube videos into podcasts that you can listen to in your favorite podcast app. Simply send a YouTube link to the bot and it will download the video, extract the audio, and generate an RSS feed that you can host on your server.

The bot is built using Deno, a secure runtime for JavaScript and TypeScript, and uses the [ytdl-core](https://www.npmjs.com/package/ytdl-core) library to download and extract the audio from the YouTube video. It also uses the [podcast](https://www.npmjs.com/package/podcast) library to generate the RSS feed.

To use the bot, you'll need to set up a Telegram bot and obtain an API token. You'll also need to have Deno and TypeScript installed on your machine.

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/uqe/youtube2rss
   ```

2. Install dependencies:

   ```
   deno install --allow-net --allow-read --allow-write --unstable src/deps.ts
   deno cache src/deps.ts --node-modules-dir
   ```

3. Create a `.env` file with your Telegram bot API token:

   ```
   TELEGRAM_TOKEN=your-telegram-bot-token
   SERVER_URL=https://your-server-url
   ```

4. Create SQLite database:

   ```
   deno task prepare
   ```

5. Start the bot:

   ```
   deno task telegram
   ```

## Usage

1. Start a chat with your bot on Telegram.

2. Send a YouTube link to the bot.

3. The bot will download the video, extract the audio, and generate an RSS feed.

4. Host the RSS feed on your server and subscribe to it in your favorite podcast app.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
