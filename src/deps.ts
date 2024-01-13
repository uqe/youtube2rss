import { FfmpegClass } from "https://deno.land/x/deno_ffmpeg@v3.1.0/mod.ts";
import { S3Client } from "https://deno.land/x/s3_lite_client@0.6.2/mod.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import { Podcast } from "https://esm.sh/podcast@2.0.1";

export type { Message } from "https://deno.land/x/grammy_types@v3.4.6/message.ts";
export type { VideoInfo } from "https://deno.land/x/ytdl_core@v0.1.2/src/types.ts";

export { exists, existsSync } from "https://deno.land/std@0.212.0/fs/mod.ts";
export { Bot } from "https://deno.land/x/grammy@v1.20.3/mod.ts";
export { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
export { getInfo } from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";

export { assertEquals, assertObjectMatch } from "https://deno.land/std@0.212.0/assert/mod.ts";
export { afterAll, afterEach, beforeAll, describe, it } from "https://deno.land/std@0.212.0/testing/bdd.ts";

export { FfmpegClass, parse, Podcast, S3Client, ytdl };
