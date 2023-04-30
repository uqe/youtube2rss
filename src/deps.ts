import ytdl from "https://deno.land/x/ytdl_core/mod.ts";
import ffmpegInstaller from "npm:@ffmpeg-installer/ffmpeg";
import ffmpeg from "npm:fluent-ffmpeg";

export { exists } from "https://deno.land/std/fs/mod.ts";
export { config } from "https://deno.land/x/dotenv/mod.ts";
export { Bot } from "https://deno.land/x/grammy@v1.15.3/mod.ts";
export type { Message } from "https://deno.land/x/grammy_types@v3.0.3/message.ts";
export { DB } from "https://deno.land/x/sqlite/mod.ts";
export { getInfo } from "https://deno.land/x/ytdl_core/mod.ts";
export type { VideoInfo } from "https://deno.land/x/ytdl_core@v0.1.2/src/types.ts";
export * as fs from "node:fs";
export { Podcast } from "npm:podcast";
export { ytdl };
export { ffmpeg };
export { ffmpegInstaller };
