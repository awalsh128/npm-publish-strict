import { ActionsLogger } from "@awalsh128/winston-github-actions";

/** What the action needs from a logger; ActionsLogger satisfies it, and tests pass a fake. */
export interface Log {
  info(message: string): unknown;
  warn(message: string): unknown;
  error(message: string): unknown;
  group(title: string): { dispose(): void };
}

/** Logger that writes workflow commands and follows the runner's debug setting. */
export const createLogger = (): Log => new ActionsLogger();
