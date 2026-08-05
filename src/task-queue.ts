export type TaskQueue = <T>(task: () => Promise<T>) => Promise<T>;

export const createSerialTaskQueue = (): TaskQueue => {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
};

export const mediaTaskQueue = createSerialTaskQueue();
