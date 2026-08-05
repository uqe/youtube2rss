import { registerShutdownHandlers } from "../shutdown.ts";
import { describe, expect, it } from "bun:test";

const createSignalTarget = () => {
  const listeners = new Map<NodeJS.Signals, Set<() => void>>();

  return {
    target: {
      on(signal: NodeJS.Signals, listener: () => void): void {
        const signalListeners = listeners.get(signal) ?? new Set();
        signalListeners.add(listener);
        listeners.set(signal, signalListeners);
      },
      off(signal: NodeJS.Signals, listener: () => void): void {
        listeners.get(signal)?.delete(listener);
      },
    },
    emit(signal: NodeJS.Signals): void {
      for (const listener of listeners.get(signal) ?? []) {
        listener();
      }
    },
    listenerCount(signal: NodeJS.Signals): number {
      return listeners.get(signal)?.size ?? 0;
    },
  };
};

describe("shutdown handlers", () => {
  it("should shut down once and remove all signal listeners", async () => {
    const signalTarget = createSignalTarget();
    const receivedSignals: NodeJS.Signals[] = [];
    registerShutdownHandlers({
      target: signalTarget.target,
      async shutdown(signal): Promise<void> {
        receivedSignals.push(signal);
      },
    });

    signalTarget.emit("SIGTERM");
    signalTarget.emit("SIGINT");
    await Promise.resolve();

    expect(receivedSignals).toEqual(["SIGTERM"]);
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);
    expect(signalTarget.listenerCount("SIGINT")).toBe(0);
  });

  it("should allow explicit disposal without shutting down", () => {
    const signalTarget = createSignalTarget();
    let shutdownCalls = 0;
    const registration = registerShutdownHandlers({
      target: signalTarget.target,
      shutdown(): void {
        shutdownCalls += 1;
      },
    });

    registration.dispose();
    signalTarget.emit("SIGTERM");

    expect(shutdownCalls).toBe(0);
  });
});
