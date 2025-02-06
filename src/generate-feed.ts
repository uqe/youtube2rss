import { Podcast } from "podcast";
import { isS3Configured } from "./helpers.ts";
import { isCoverImageExistsOnS3, uploadXmlToS3 } from "./s3.ts";
import { type Video } from "./types.ts";

export const serverUrl = () => (Bun.env.IS_TEST ? "https://test.com" : Bun.env.SERVER_URL);

export const rssFile = () => (Bun.env.IS_TEST ? "./public/rss.test.xml" : "./public/rss.xml");

const xml = (feed: Podcast) => (Bun.env.IS_TEST ? feed.buildXml() : feed.buildXml({ indent: "  " }));

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
  copyright: "2023 Arthur N",
  language: "ru",
  categories: ["Education", "Self-Improvement"],
  pubDate: new Date(Date.parse("2023-04-16")),
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

  for (const item of allVideos) {
    const videoFile = Bun.file(item.video_path);
    const fileExists = await videoFile.exists();

    if (!fileExists && !Bun.env.IS_TEST) {
      console.log(`File ${item.video_path} doesn't exist. Skipping...`);
    } else {
      feed.addItem({
        title: item.video_name,
        description: item.video_description ? item.video_description : "",
        url: `${serverUrl()}/files/${item.video_id}.mp3`,
        guid: item.video_id,
        author: "Arthur N",
        date: item.video_added_date,
        enclosure: !Bun.env.IS_TEST
          ? {
              url: `${serverUrl()}/files/${item.video_id}.mp3`,
              file: item.video_path,
              type: "audio/mp3",
            }
          : undefined,
        itunesAuthor: "Arthur N",
        itunesExplicit: false,
        itunesSubtitle: item.video_name,
        itunesSummary: item.video_name,
        itunesDuration: item.video_length,
      });
    }
  }

  Bun.write(rssFile(), xml(feed));

  if (isS3Configured()) {
    await uploadXmlToS3(rssFile());
    await isCoverImageExistsOnS3();
  }
};
