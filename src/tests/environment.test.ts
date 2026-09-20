import { expect, it } from "bun:test";

import { restoreEnvironment } from "./environment.ts";

it.each([undefined, "", "original"])("should restore an environment value of %s", (value) => {
  const name = "YOUTUBE2RSS_TEST_RESTORE";
  const unrelatedName = "YOUTUBE2RSS_TEST_UNRELATED";
  const originalValue = Bun.env[name];
  const originalUnrelatedValue = Bun.env[unrelatedName];

  try {
    Bun.env[name] = "changed";
    Bun.env[unrelatedName] = "untouched";

    restoreEnvironment({ [name]: value });

    expect<string | undefined>(Bun.env[name]).toBe(value);
    expect(Object.hasOwn(Bun.env, name)).toBe(value !== undefined);
    expect(Bun.env[unrelatedName]).toBe("untouched");
  } finally {
    for (const [key, original] of [
      [name, originalValue],
      [unrelatedName, originalUnrelatedValue],
    ] as const) {
      if (original === undefined) {
        delete Bun.env[key];
      } else {
        Bun.env[key] = original;
      }
    }
  }
});
