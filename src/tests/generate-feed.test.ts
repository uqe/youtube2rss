import { parse } from "@libs/xml";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { generateFeed, rssFile, serverUrl } from "../generate-feed.ts";
import { type Video } from "../types.ts";
import { formatSeconds } from "./../helpers";

interface RSSDoc {
  rss: {
    channel: {
      description: string;
      link: string;
      generator: string;
      title: string;
    };
  };
}

// Mock data for testing
const mockVideos: Video[] = [
  {
    video_id: "Gd8pjyqGf7E",
    video_name: "Манул: Свободный степной отшельник | Интересные факты про палласова кота",
    video_description: `Greetings, you are on the Planet Earth channel. Here we will study interesting facts about our Land. Wildlife, plants, natural phenomena, geography and much more. Subscribe, you won't regret it!
    Today we will talk about Manula. What do we know about him?
    In fact, almost nothing. Manul is a mysterious and attractive cat, even simple stories and notes about him always arouse interest. So let's look Manul in the yellow eyes and ask about the secrets of his life. Go…`,
    video_url: "https://www.youtube.com/watch?v=Gd8pjyqGf7E",
    video_added_date: "2022-01-01",
    video_path: "/public/files/Gd8pjyqGf7E.mp3",
    video_length: 1153,
  },
  {
    video_id: "_9db9D4um0Y",
    video_name: "What’s New in Arc: Space Creation, Windows Update, Haptic Tabs and more",
    video_description: `This week's Arc update is a big one, so we're trying something different - catch up with Josh, Dara and Alexandra as they share What's New in Arc.`,
    video_url: "https://www.youtube.com/watch?v=_9db9D4um0Y",
    video_added_date: "2022-01-02",
    video_path: "/public/files/_9db9D4um0Y.mp3",
    video_length: 228,
  },
];

// Mock function for getAllVideos
const getAllVideos = () => mockVideos;

describe("generate-feed tests", () => {
  beforeAll(() => {
    generateFeed(getAllVideos());
  });

  afterAll(async () => {
    await Bun.file(rssFile()).delete();
  });

  describe("generateFeed", () => {
    it("should have correct RSS channel metadata", async () => {
      const xml = Bun.file(rssFile());
      const byteArray = new TextDecoder().decode(await xml.bytes());
      const doc = parse(byteArray) as unknown as RSSDoc;

      expect(doc.rss.channel.description).toBe("YouTube personal feed");
      expect(doc.rss.channel.link).toBe("https://github.com/uqe/youtube2rss");
      expect(doc.rss.channel.generator).toBe("https://github.com/uqe/youtube2rss");
      expect(doc.rss.channel.title).toBe("YouTube");
    });
  });

  describe("generateFeed", () => {
    it("should generate correct RSS items for each video", async () => {
      const xml = Bun.file(rssFile());
      const byteArray = new TextDecoder().decode(await xml.bytes());

      mockVideos.forEach((video) => {
        const title = `<title><![CDATA[${video.video_name}]]></title>`;
        const description = `<description><![CDATA[${video.video_description || ""}]]></description>`;
        const link = `<link>${serverUrl()}/files/${video.video_id}.mp3</link>`;
        const guid = `<guid isPermaLink="false">${video.video_id}</guid>`;
        const creator = `<dc:creator><![CDATA[Arthur N]]></dc:creator>`;
        const date = `<pubDate>${new Date(video.video_added_date).toUTCString()}</pubDate>`;
        const author = `<itunes:author>Arthur N</itunes:author>`;
        const subtitle = `<itunes:subtitle>${video.video_name}</itunes:subtitle>`;
        const summary = `<itunes:summary>${video.video_name}</itunes:summary>`;
        const explicit = `<itunes:explicit>false</itunes:explicit>`;
        const duration = `<itunes:duration>${formatSeconds(video.video_length)}</itunes:duration>`;
        const item = `<item>${title}${description}${link}${guid}${creator}${date}${author}${subtitle}${summary}${explicit}${duration}</item>`;

        expect(byteArray.includes(item)).toBe(true);
      });
    });
  });
});
