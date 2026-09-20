export const restoreEnvironment = (snapshot: Record<string, string | undefined>): void => {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete Bun.env[name];
    } else {
      Bun.env[name] = value;
    }
  }
};
