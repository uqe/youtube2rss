import { convertVideo } from "../convert-video.ts";
import { afterAll, assertEquals, describe, it, VideoInfo } from "../deps.ts";
import { getFilePath } from "../helpers.ts";

const videoInfo: VideoInfo = {
  //@ts-ignore: we need only videoId
  videoDetails: {
    videoId: "daw9YO3nAJI",
    title: "Ночной Экспресс глазами машиниста поезда",
    description:
      "Привет! Добро пожаловать на мой канал! В этом видео я, машинист поезда, приглашаю вас в захватывающий мир управления железнодорожным транспортом. Погрузитесь в атмосферу работы от первого лица . Я покажу вам все тонкости и нюансы работы машиниста, включая принятие решений на лету и реакцию на изменяющиеся условия на пути. Приготовьтесь к захватывающей поездке и окунитесь в настоящую работу машиниста поезда с моим рассказом от первого лица! Буду рад видеть вас на моем канале!",
    video_url: "https://www.youtube.com/watch?v=daw9YO3nAJI",
    lengthSeconds: "370",
  },
};

describe("convert-video tests", () => {
  afterAll(() => {
    Deno.remove(getFilePath(videoInfo.videoDetails.videoId, "mp3"));
  });

  describe("convertVideo", () => {
    it("should convert video to mp3", async () => {
      await convertVideo(videoInfo);
      const file = await Deno.stat(getFilePath(videoInfo.videoDetails.videoId, "mp3"));
      assertEquals(file.isFile, true);
    });
  });
});
