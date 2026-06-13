import { createDb } from "./db.ts";

export const prepare = async () => {
  await createDb();
};

if (import.meta.main) {
  await prepare();
}
