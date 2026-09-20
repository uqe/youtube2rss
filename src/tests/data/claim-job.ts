import { createDatabaseFactory } from "../../db.ts";
import { createJobRepository } from "../../jobs.ts";

const dbFactory = createDatabaseFactory(() => Bun.argv[2]);
const jobs = createJobRepository({ dbFactory });
console.log(jobs.claim("child")?.id ?? "none");
await Bun.stdin.text();
