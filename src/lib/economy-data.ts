import definitions from '../data/economy-series.json';
import observations from '../data/economy.json';
import publishedStatements from '../data/economic-statements.json';
import {
  seriesConfigSchema,
  economySchema,
  statementsSchema,
  eurostatLinks,
  validateEconomy,
  statementResult,
} from './economy.mjs';

const config = seriesConfigSchema.parse(definitions);
const snapshot = economySchema.parse(observations);
const rawStatements = statementsSchema.parse(publishedStatements);
const errors = validateEconomy(config, snapshot, rawStatements);
if (errors.length) throw new Error(errors.join('\n'));

export const economyCollectedAt = snapshot.collectedAt;
export const economy = snapshot.series.map((series) => {
  const definition = config.find(({ id }) => id === series.id)!;
  return {
    ...definition,
    ...series,
    links: eurostatLinks(definition, snapshot.since),
    latest: series.observations.findLast(([, value]) => value !== null)!,
  };
});
export const statements = rawStatements.map((item) => ({
  ...item,
  result: statementResult(item),
}));
