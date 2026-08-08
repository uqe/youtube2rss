import { createSerialTaskQueue } from "../task-queue.ts";
import { describe, expect, it } from "bun:test";

describe("serial task queue", () => {
  it("should return the task result", async () => {
    const enqueue = createSerialTaskQueue();

    await expect(enqueue(async () => 42)).resolves.toBe(42);
  });

  it("should run tasks in submission order", async () => {
    const enqueue = createSerialTaskQueue();
    const events: string[] = [];

    const first = enqueue(async () => {
      events.push("first:start");
      await Promise.resolve();
      events.push("first:end");
    });
    const second = enqueue(async () => {
      events.push("second");
    });

    await Promise.all([first, second]);

    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("should keep the next task waiting until the current task settles", async () => {
    const enqueue = createSerialTaskQueue();
    let releaseFirst: (() => void) | undefined;
    let secondStarted = false;

    const first = enqueue(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        })
    );
    const second = enqueue(async () => {
      secondStarted = true;
    });

    await Promise.resolve();
    expect(secondStarted).toBe(false);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(secondStarted).toBe(true);
  });

  it("should continue processing after an asynchronous rejection", async () => {
    const enqueue = createSerialTaskQueue();
    const failure = new Error("first failed");
    const first = enqueue(async () => {
      throw failure;
    });
    const second = enqueue(async () => "recovered");

    await expect(first).rejects.toBe(failure);
    await expect(second).resolves.toBe("recovered");
  });

  it("should continue processing after a synchronous throw", async () => {
    const enqueue = createSerialTaskQueue();
    const events: string[] = [];
    const first = enqueue(() => {
      events.push("failed");
      throw new Error("boom");
    });
    const second = enqueue(async () => {
      events.push("continued");
    });

    await expect(first).rejects.toThrow("boom");
    await second;
    expect(events).toEqual(["failed", "continued"]);
  });

  it("should accept a task submitted by a running task", async () => {
    const enqueue = createSerialTaskQueue();
    const events: string[] = [];
    let nested: Promise<void> | undefined;

    await enqueue(async () => {
      events.push("outer");
      nested = enqueue(async () => {
        events.push("nested");
      });
    });
    await nested;

    expect(events).toEqual(["outer", "nested"]);
  });

  it("should keep separately created queues independent", async () => {
    const blockedQueue = createSerialTaskQueue();
    const freeQueue = createSerialTaskQueue();
    let releaseBlocked: (() => void) | undefined;

    const blocked = blockedQueue(
      () =>
        new Promise<void>((resolve) => {
          releaseBlocked = resolve;
        })
    );

    await expect(freeQueue(async () => "done")).resolves.toBe("done");
    releaseBlocked?.();
    await blocked;
  });
});
