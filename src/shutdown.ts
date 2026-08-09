export interface SignalTarget {
  on(signal: NodeJS.Signals, listener: () => void): void;
  off(signal: NodeJS.Signals, listener: () => void): void;
}

export interface ShutdownHandlerOptions {
  shutdown(signal: NodeJS.Signals): Promise<void> | void;
  target?: SignalTarget;
  signals?: NodeJS.Signals[];
}

export const registerShutdownHandlers = ({
  shutdown,
  target = process,
  signals = ["SIGINT", "SIGTERM"],
}: ShutdownHandlerOptions) => {
  let isShuttingDown = false;

  const dispose = () => {
    for (const signal of signals) {
      const handler = handlers.get(signal);
      if (handler) {
        target.off(signal, handler);
      }
    }
  };

  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of signals) {
    const handler = () => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      dispose();
      void shutdown(signal);
    };
    handlers.set(signal, handler);
    target.on(signal, handler);
  }

  return { dispose };
};
