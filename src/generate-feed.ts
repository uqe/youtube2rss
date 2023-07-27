import { serverUrl } from "./config.ts";
import { Podcast } from "./deps.ts";
import { uploadXmlToS3 } from "./s3.ts";

const rssFile = Deno.env.get("IS_TEST") ? "./public/rss.test.xml" : "./public/rss.xml";

const feedOptions = {
  title: "YouTube",
  description: "YouTube personal feed",
  feedUrl: `${serverUrl}/rss.xml`,
  siteUrl: "https://github.com/uqe/youtube2rss",
  imageUrl: `${serverUrl}/cover.jpg`,
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
  itunesImage: `${serverUrl}/cover.jpg`,
};

export interface Video {
  video_id: string;
  video_name: string;
  video_description: string | null;
  video_url: string;
  video_added_date: string;
  video_path: string;
  video_length: string;
}

export const generateFeed = (allVideos: Video[]) => {
  const feed = new Podcast(feedOptions);

  allVideos.forEach((item) => {
    feed.addItem({
      title: item.video_name,
      description: item.video_description ? item.video_description : "",
      url: `${serverUrl}/files/${item.video_id}.mp3`,
      guid: item.video_id,
      author: "Arthur N",
      date: item.video_added_date,
      enclosure: !Deno.env.get("IS_TEST")
        ? {
            url: `${serverUrl}/files/${item.video_id}.mp3`,
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
  });

  const xml = Deno.env.get("IS_TEST") ? feed.buildXml() : feed.buildXml({ indent: "  " });

  Deno.writeTextFileSync(rssFile, xml);

  uploadXmlToS3(rssFile);
};
