import { existsSync, Podcast } from "./deps.ts";
import { isS3Configured } from "./helpers.ts";
import { isCoverImageExistsOnS3, uploadXmlToS3 } from "./s3.ts";

const serverUrl = () => (Deno.env.get("IS_TEST") ? "https://test.com" : Deno.env.get("SERVER_URL"));

const rssFile = () => (Deno.env.get("IS_TEST") ? "./public/rss.test.xml" : "./public/rss.xml");

const xml = (feed: Podcast) => (Deno.env.get("IS_TEST") ? feed.buildXml() : feed.buildXml({ indent: "  " }));

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

  allVideos.forEach((item) => {
    const fileExists = existsSync(item.video_path);

    if (!fileExists && !Deno.env.get("IS_TEST")) {
      console.log(`File ${item.video_path} doesn't exist. Skipping...`);
    } else {
      feed.addItem({
        title: item.video_name,
        description: item.video_description ? item.video_description : "",
        url: `${serverUrl()}/files/${item.video_id}.mp3`,
        guid: item.video_id,
        author: "Arthur N",
        date: item.video_added_date,
        enclosure: !Deno.env.get("IS_TEST")
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
  });

  Deno.writeTextFileSync(rssFile(), xml(feed));

  if (isS3Configured()) {
    await uploadXmlToS3(rssFile());
    await isCoverImageExistsOnS3();
  }
};
