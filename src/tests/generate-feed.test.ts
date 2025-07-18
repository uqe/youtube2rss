import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { parse } from "@libs/xml";
import { generateFeed, rssFile, serverUrl } from "../generate-feed.ts";
import { formatSeconds } from "./../helpers";
import type { Video } from "../types.ts";

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
      const xmlContent = await Bun.file(rssFile()).text();
      const doc = parse(xmlContent) as unknown as RSSDoc;

      expect(doc.rss.channel.description).toBe("YouTube personal feed");
      expect(doc.rss.channel.link).toBe("https://github.com/uqe/youtube2rss");
      expect(doc.rss.channel.generator).toBe("https://github.com/uqe/youtube2rss");
      expect(doc.rss.channel.title).toBe("YouTube");
    });

    it("should generate correct RSS items for each video", async () => {
      const xmlContent = await Bun.file(rssFile()).text();

      mockVideos.forEach((video) => {
        const title = `<title><![CDATA[${video.video_name}]]></title>`;
        const description = `<description><![CDATA[${video.video_description || ""}]]></description>`;
        const link = `<link>${serverUrl()}/files/${video.video_id}.mp3</link>`;
        const guid = `<guid isPermaLink="false">${video.video_id}</guid>`;
        const creator = "<dc:creator><![CDATA[Arthur N]]></dc:creator>";
        const date = `<pubDate>${new Date(video.video_added_date).toUTCString()}</pubDate>`;
        const author = "<itunes:author>Arthur N</itunes:author>";
        const subtitle = `<itunes:subtitle>${video.video_name}</itunes:subtitle>`;
        const summary = `<itunes:summary>${video.video_description?.replaceAll("'", "&apos;")}</itunes:summary>`;
        const explicit = "<itunes:explicit>false</itunes:explicit>";
        const duration = `<itunes:duration>${formatSeconds(video.video_length)}</itunes:duration>`;
        const item = `<item>${title}${description}${link}${guid}${creator}${date}${author}${subtitle}${summary}${explicit}${duration}</item>`;

        expect(xmlContent.includes(item)).toBe(true);
      });
    });

    it("should correctly handle special characters in titles", async () => {
      const specialCharsVideo: Video = {
        video_id: "SpecialChars",
        video_name: 'Test & special <characters> in "title"',
        video_description: "Description with & < > \" ' characters",
        video_url: "https://example.com",
        video_added_date: "2022-01-04",
        video_path: "/src/tests/data/daw9YO3nAJI.mp4",
        video_length: 200,
      };

      await generateFeed([specialCharsVideo]);

      const xmlContent = await Bun.file(rssFile()).text();

      expect(xmlContent).toContain(`<title><![CDATA[${specialCharsVideo.video_name}]]></title>`);
      expect(xmlContent).toContain(`<description><![CDATA[${specialCharsVideo.video_description}]]></description>`);
    });

    it("should handle non-existent files in test mode", async () => {
      const nonExistentVideo: Video = {
        video_id: "NonExistVideo",
        video_name: "Non-existent video",
        video_description: "This video does not exist",
        video_url: "https://example.com",
        video_added_date: "2022-01-03",
        video_path: "/path/to/nonexistent/file.mp3",
        video_length: 100,
      };

      await generateFeed([nonExistentVideo]);

      const fileExists = await Bun.file(rssFile()).exists();

      expect(fileExists).toBe(true);

      const xmlContent = await Bun.file(rssFile()).text();

      expect(xmlContent).toContain(nonExistentVideo.video_id);
      expect(xmlContent).toContain(nonExistentVideo.video_name);
    });
  });
});
