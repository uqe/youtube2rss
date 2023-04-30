import fs from "node:fs";
import { Podcast } from "npm:podcast";
import { getAllVideos } from "./db.ts";
import { serverUrl } from "./config.ts";

const feedOptions = {
  title: "YouTube",
  description: "YouTube personal feed",
  feedUrl: `${serverUrl}/rss.xml`,
  siteUrl: "https://github.com/uqe/youtube2rss",
  imageUrl: `${serverUrl}/cover.png`,
  author: "Arthur N",
  managingEditor: "Arthur N",
  generator: "https://github.com/uqe/youtube2rss",
  webMaster: "Arthur N",
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
  itunesImage: `${serverUrl}/cover.png`,
};

export interface Video {
  id: number;
  video_id: string;
  video_name: string;
  video_description: string | null;
  video_url: string;
  video_added_date: string;
  video_path: string;
  video_length: string;
}

const generateFeed = () => {
  const allVideos = getAllVideos();
  const feed = new Podcast(feedOptions);

  allVideos.forEach((item) => {
    feed.addItem({
      title: item.video_name,
      description: item.video_description ? item.video_description : "",
      url: `${serverUrl}/files/${item.video_id}.mp3`,
      guid: item.video_id,
      author: "Arthur N",
      date: item.video_added_date,
      enclosure: {
        url: `${serverUrl}/files/${item.video_id}.mp3`,
        file: item.video_path,
        type: "audio/mp3",
      },
      itunesAuthor: "Arthur N",
      itunesExplicit: false,
      itunesSubtitle: item.video_name,
      itunesSummary: item.video_name,
      itunesDuration: item.video_length,
    });
  });

  const xml = feed.buildXml();
  const stream = fs.createWriteStream("./public/rss.xml");
  stream.write(xml);
};

generateFeed();

export { generateFeed };
