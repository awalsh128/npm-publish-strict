import { ActionsLogger } from "@awalsh128/winston-github-actions";
/** Logger that writes workflow commands and follows the runner's debug setting. */
export const createLogger = () => new ActionsLogger();
