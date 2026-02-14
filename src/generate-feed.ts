import { getRssFilePath, getServerUrl, isTestEnv } from "./config.ts";
import { logger } from "./logger.ts";
import { getStorage } from "./storage.ts";
import type { Video } from "./types.ts";
import { Podcast } from "podcast";

export const serverUrl = () => getServerUrl();

export const rssFile = () => getRssFilePath();

const xml = (feed: Podcast) => (isTestEnv() ? feed.buildXml() : feed.buildXml({ indent: "  " }));

const feedOptions = {
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
};

export const generateFeed = async (allVideos: Video[]) => {
  const feed = new Podcast(feedOptions);
  const storage = getStorage();

  for (const item of allVideos) {
    const videoFile = Bun.file(item.video_path);
    const fileExists = await videoFile.exists();

    if (!fileExists && !isTestEnv()) {
      logger.info(`File ${item.video_path} doesn't exist. Skipping...`);
      continue;
    }

    feed.addItem({
      title: item.video_name,
      description: item.video_description ?? "",
      url: `${serverUrl()}/files/${item.video_id}.mp3`,
      guid: item.video_id,
      author: "Arthur N",
      date: item.video_added_date,
      enclosure: !isTestEnv()
        ? {
            url: `${serverUrl()}/files/${item.video_id}.mp3`,
            file: item.video_path,
            type: "audio/mp3",
          }
        : undefined,
      itunesAuthor: "Arthur N",
      itunesExplicit: false,
      itunesSubtitle: item.video_name,
      itunesSummary: item.video_description ?? "",
      itunesDuration: item.video_length,
    });
  }

  await Bun.write(rssFile(), xml(feed));

  if (!isTestEnv()) {
    await storage.uploadRss(rssFile());
    await storage.ensureCoverImage();
  }
};
