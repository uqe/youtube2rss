import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import ffmpegInstaller from "npm:@ffmpeg-installer/ffmpeg";
import ffmpeg from "npm:fluent-ffmpeg";
import { Podcast } from "npm:podcast";
import fs from "node:fs";

export type { Message } from "https://deno.land/x/grammy_types@v3.0.3/message.ts";
export type { VideoInfo } from "https://deno.land/x/ytdl_core@v0.1.2/src/types.ts";

export { exists } from "https://deno.land/std@0.185.0/fs/mod.ts";
export { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
export { Bot } from "https://deno.land/x/grammy@v1.15.3/mod.ts";
export { DB } from "https://deno.land/x/sqlite@v3.7.2/mod.ts";
export { getInfo } from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";

export { Podcast, ytdl, ffmpeg, ffmpegInstaller, fs };
