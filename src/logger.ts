// ./src/logger.ts
import adze, { setup } from "adze";

setup({
  levels: {
    error: {
      levelName: "error",
      level: 1,
      method: "error",
      style: "color: purple; background: white;", // <- changing the error style to use purple text.
      terminalStyle: ["magenta", "bgWhite"],
      emoji: "🔥",
    },
  },
});

export const logger = adze.withEmoji.timestamp.seal();
