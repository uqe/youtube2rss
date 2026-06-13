import { getRssFilePath, getServerUrl, isTestEnv } from "./config.ts";
import { logger } from "./logger.ts";
import { getStorage } from "./storage.ts";
import type { Storage } from "./storage.ts";
import type { Video } from "./types.ts";
import { Podcast } from "podcast";

export const serverUrl = () => getServerUrl();

export const rssFile = () => getRssFilePath();

export const getAudioUrl = (videoId: string) => `${serverUrl()}/files/${videoId}.mp3`;

const xml = (feed: Podcast) => (isTestEnv() ? feed.buildXml() : feed.buildXml({ indent: "  " }));

export const createFeedOptions = () => ({
  title: "YouTube",
  description: "YouTube personal feed",
  feedUrl: `${serverUrl()}/rss.xml`,
  siteUrl: "https://github.com/uqe/youtube2rss",
  imageUrl: `${serverUrl()}/cover.jpg`,
  author: "Arthur N",
  managingEditor: "arthurn@duck.com",
  generator: "https://github.com/uqe/youtube2rss",
  webMaster: "arthurn@duck.com",
  copyright: "2025 Arthur N",
  language: "ru",
  categories: ["Education", "Self-Improvement"],
  pubDate: new Date(Date.parse("2025-02-26")),
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
  itunesImage: `${serverUrl()}/cover.jpg`,
});

type FeedItem = Parameters<Podcast["addItem"]>[0];

export const createFeedItem = (video: Video, shouldIncludeEnclosure = !isTestEnv()): FeedItem => {
  const audioUrl = getAudioUrl(video.video_id);

  return {
    title: video.video_name,
    description: video.video_description ?? "",
    url: audioUrl,
    guid: video.video_id,
    author: "Arthur N",
    date: video.video_added_date,
    enclosure: shouldIncludeEnclosure
      ? {
          url: audioUrl,
          file: video.video_path,
          type: "audio/mp3",
        }
      : undefined,
    itunesAuthor: "Arthur N",
    itunesExplicit: false,
    itunesSubtitle: video.video_name,
    itunesSummary: video.video_description ?? "",
    itunesDuration: video.video_length,
  };
};

export interface GenerateFeedOptions {
  storage?: Storage;
}

export const generateFeed = async (allVideos: Video[], { storage = getStorage() }: GenerateFeedOptions = {}) => {
  const feed = new Podcast(createFeedOptions());

  for (const item of allVideos) {
    const videoFile = Bun.file(item.video_path);
    const fileExists = await videoFile.exists();

    if (!fileExists && !isTestEnv()) {
      logger.info(`File ${item.video_path} doesn't exist. Skipping...`);
      continue;
    }

    feed.addItem(createFeedItem(item));
  }

  await Bun.write(rssFile(), xml(feed));

  if (!isTestEnv()) {
    await storage.uploadRss(rssFile());
    await storage.ensureCoverImage();
  }
};
