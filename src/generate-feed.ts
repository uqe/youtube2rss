import { Podcast } from "podcast";

import { getRequiredServerUrl, getRssFilePath } from "./config.ts";
import { logger } from "./logger.ts";
import { getStorage } from "./storage.ts";
import type { AudioMetadata, Storage } from "./storage.ts";
import type { Video } from "./types.ts";

const repositoryUrl = "https://github.com/uqe/youtube2rss";

export const serverUrl = () => getRequiredServerUrl();

export const rssFile = () => getRssFilePath();

export const getAudioUrl = (videoId: string, baseUrl = serverUrl()) => `${baseUrl}/files/${videoId}.mp3`;

export const getArtworkUrl = (videoId: string, baseUrl = serverUrl()) => `${baseUrl}/covers/${videoId}.jpg`;

export const getChaptersUrl = (videoId: string, baseUrl = serverUrl()) => `${baseUrl}/chapters/${videoId}.json`;

export interface FeedOptionsInput {
  baseUrl?: string;
  now?: Date;
}

export const createFeedOptions = ({ baseUrl = serverUrl(), now = new Date() }: FeedOptionsInput = {}) => ({
  title: "YouTube",
  description: "YouTube personal feed",
  feedUrl: `${baseUrl}/rss.xml`,
  siteUrl: repositoryUrl,
  imageUrl: `${baseUrl}/cover.jpg`,
  author: "Arthur N",
  managingEditor: "arthurn@duck.com",
  generator: repositoryUrl,
  webMaster: "arthurn@duck.com",
  copyright: `${now.getUTCFullYear()} Arthur N`,
  language: "ru",
  categories: ["Education", "Self-Improvement"],
  pubDate: now,
  ttl: 5,
  itunesAuthor: "Arthur N",
  itunesSubtitle: "YouTube personal feed",
  itunesSummary: "YouTube personal feed",
  itunesOwner: { name: "Arthur N", email: "arthurn@duck.com" },
  itunesExplicit: false,
  itunesCategory: [
    {
      text: "Education",
      subcats: [
        {
          text: "Self-Improvement",
        },
      ],
    },
  ],
  itunesImage: `${baseUrl}/cover.jpg`,
  namespaces: { podcast: true },
});

type FeedItem = Parameters<Podcast["addItem"]>[0];

export const createFeedItem = (
  video: Video,
  audio?: AudioMetadata,
  baseUrl = serverUrl(),
  includeChapters = Boolean(video.video_chapters_path),
): FeedItem => {
  const audioUrl = getAudioUrl(video.video_id, baseUrl);

  return {
    title: video.video_name,
    description: video.video_description ?? "",
    url: video.video_url,
    guid: video.video_id,
    author: "Arthur N",
    date: video.video_added_date,
    enclosure: audio?.exists
      ? {
          url: audioUrl,
          file: audio.filePath,
          size: audio.size,
          type: "audio/mpeg",
        }
      : undefined,
    itunesAuthor: "Arthur N",
    itunesExplicit: false,
    itunesSubtitle: video.video_name,
    itunesSummary: video.video_description ?? "",
    itunesDuration: video.video_length,
    itunesImage: video.video_artwork_path ? getArtworkUrl(video.video_id, baseUrl) : undefined,
    customElements:
      includeChapters && video.video_chapters_path
        ? [
            {
              "podcast:chapters": [
                {
                  _attr: {
                    url: getChaptersUrl(video.video_id, baseUrl),
                    type: "application/json+chapters",
                  },
                },
              ],
            },
          ]
        : undefined,
  };
};

export interface GenerateFeedOptions {
  storage?: Storage;
  baseUrl?: string;
  rssFilePath?: string;
  now?: Date;
  publish?: boolean;
  verifyAudio?: boolean;
  includeEnclosures?: boolean;
}

const getTimestamp = (video: Video) => {
  const timestamp = Date.parse(video.video_added_date);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const generateFeed = async (
  allVideos: Video[],
  {
    storage = getStorage(),
    baseUrl = serverUrl(),
    rssFilePath = rssFile(),
    now = new Date(),
    publish = true,
    verifyAudio = true,
    includeEnclosures = true,
  }: GenerateFeedOptions = {},
) => {
  const feed = new Podcast(createFeedOptions({ baseUrl, now }));
  const orderedVideos = allVideos.toSorted((left, right) => getTimestamp(right) - getTimestamp(left));

  for (const item of orderedVideos) {
    const audio = verifyAudio ? await storage.getAudioMetadata(item.video_id, item.video_path) : { exists: true };

    if (!audio.exists) {
      logger.info(`Audio is unavailable for video ${item.video_id}; skipping RSS item`);
      continue;
    }

    const chapters = item.video_chapters_path
      ? await storage.getChaptersMetadata(item.video_id, item.video_chapters_path)
      : { exists: false };

    if (item.video_chapters_path && !chapters.exists) {
      logger.info(`Chapters are unavailable for video ${item.video_id}; omitting podcast:chapters`);
    }

    feed.addItem(createFeedItem(item, includeEnclosures ? audio : undefined, baseUrl, chapters.exists));
  }

  await Bun.write(rssFilePath, feed.buildXml({ indent: "  " }));

  if (publish) {
    await storage.uploadRss(rssFilePath);
    await storage.ensureCoverImage();
  }
};
