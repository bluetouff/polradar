import { watch } from './data';
import history from '../data/daily-updates.json';
import { dailyHistorySchema, sourceFreshness } from './daily-updates.mjs';
export const technicalFreshness = sourceFreshness([
  ...watch,
  ...dailyHistorySchema.parse(history).flatMap((run) => run.sourceChecks ?? []),
]);
