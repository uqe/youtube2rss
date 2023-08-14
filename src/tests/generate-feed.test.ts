import { afterAll, assertEquals, describe, it, parse } from "../deps.ts";
import { generateFeed, Video } from "../generate-feed.ts";

const serverUrl = "https://test.com";

const rssFile = "./public/rss.test.xml";

// Mock data for testing
const mockVideos: Video[] = [
  {
    video_id: "Gd8pjyqGf7E",
    video_name: "Манул: Свободный степной отшельник | Интересные факты про палласова кота",
    video_description:
      `Greetings, you are on the Planet Earth channel. Here we will study interesting facts about our Land. Wildlife, plants, natural phenomena, geography and much more. Subscribe, you won't regret it!
    Today we will talk about Manula. What do we know about him?
    In fact, almost nothing. Manul is a mysterious and attractive cat, even simple stories and notes about him always arouse interest. So let's look Manul in the yellow eyes and ask about the secrets of his life. Go…`,
    video_url: "https://www.youtube.com/watch?v=Gd8pjyqGf7E",
    video_added_date: "2022-01-01",
    video_path: "/public/files/Gd8pjyqGf7E.mp3",
    video_length: "00:21:34",
  },
  {
    video_id: "_9db9D4um0Y",
    video_name: "What’s New in Arc: Space Creation, Windows Update, Haptic Tabs and more",
    video_description:
      `This week's Arc update is a big one, so we're trying something different - catch up with Josh, Dara and Alexandra as they share What's New in Arc.`,
    video_url: "https://www.youtube.com/watch?v=_9db9D4um0Y",
    video_added_date: "2022-01-02",
    video_path: "/public/files/_9db9D4um0Y.mp3",
    video_length: "00:04:45",
  },
];

// Mock function for getAllVideos
const getAllVideos = () => mockVideos;

describe("generate-feed tests", () => {
  afterAll(() => {
    Deno.remove(rssFile);
  });

  describe("generateFeed", () => {
    it("should create a valid RSS feed XML string and should include all videos in the RSS feed", () => {
      generateFeed(getAllVideos());

      const xml = Deno.readTextFileSync(rssFile);
      const doc = parse(xml);

      // @ts-ignore: ...
      assertEquals(doc.rss.channel.description, "YouTube personal feed");
      // @ts-ignore: ...
      assertEquals(doc.rss.channel.link, "https://github.com/uqe/youtube2rss");
      // @ts-ignore: ...
      assertEquals(doc.rss.channel.generator, "https://github.com/uqe/youtube2rss");
      // @ts-ignore: ...
      assertEquals(doc.rss.channel.title, "YouTube");

      mockVideos.forEach((video) => {
        const title = `<title><![CDATA[${video.video_name}]]></title>`;
        const description = `<description><![CDATA[${video.video_description || ""}]]></description>`;
        const link = `<link>${serverUrl}/files/${video.video_id}.mp3</link>`;
        const guid = `<guid isPermaLink="false">${video.video_id}</guid>`;
        const creator = `<dc:creator><![CDATA[Arthur N]]></dc:creator>`;
        const date = `<pubDate>${new Date(video.video_added_date).toUTCString()}</pubDate>`;
        const author = `<itunes:author>Arthur N</itunes:author>`;
        const subtitle = `<itunes:subtitle>${video.video_name}</itunes:subtitle>`;
        const summary = `<itunes:summary>${video.video_name}</itunes:summary>`;
        const explicit = `<itunes:explicit>false</itunes:explicit>`;
        const duration = `<itunes:duration>${video.video_length}</itunes:duration>`;
        const item =
          `<item>${title}${description}${link}${guid}${creator}${date}${author}${subtitle}${summary}${explicit}${duration}</item>`;

        assertEquals(xml.includes(item), true);
      });
    });
  });
});
