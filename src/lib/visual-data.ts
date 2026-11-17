import airtimeRows from '../data/airtime.json';
import budgetRows from '../data/programme-budgets.json';
import agendaRows from '../data/campaign-agenda.json';
import mapRows from '../data/france-map.json';
import { airtimeSchema } from './airtime.mjs';
import {
  programmeBudgetSchema,
  agendaSchema,
  mapSchema,
  validateVisualReferences,
} from './campaign-visuals.mjs';
import { candidates, sources } from './data';

export const airtime = airtimeSchema.parse(airtimeRows);
export const programmeBudgets = programmeBudgetSchema.parse(budgetRows);
export const agenda = agendaSchema.parse(agendaRows);
export const franceMap = mapSchema.parse(mapRows);
const errors = validateVisualReferences(
  programmeBudgets,
  agenda,
  candidates,
  sources,
);
if (errors.length) throw new Error(errors.join('\n'));
