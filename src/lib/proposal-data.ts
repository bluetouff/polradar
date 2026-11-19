import evolutionRows from '../data/proposal-evolution.json';
import financeRows from '../data/financing-maps.json';
import {
  evolutionSchema,
  financingSchema,
  validateProposalReferences,
} from './proposal-evidence.mjs';
import { dataset } from './data';
import { programmeBudgets } from './visual-data';
export const evolution = evolutionSchema.parse(evolutionRows);
export const financing = financingSchema.parse(financeRows);
const errors = validateProposalReferences(
  evolution,
  financing,
  dataset,
  programmeBudgets,
);
if (errors.length) throw new Error(errors.join('\n'));
export const proposalTracks = evolution.tracks.map((track) => ({
  ...track,
  states: track.stateIds.map((id) =>
    evolution.states.find((s) => s.id === id)!,
  ),
}));
export const financingMaps = financing.maps.map((map) => {
  const profile = programmeBudgets.profiles.find(
    (p) => p.candidate === map.candidate,
  )!;
  const entry = profile.entries.find((e) => e.id === map.budgetEntry)!;
  return { ...map, scope: entry.scope ?? profile.scope, entry };
});
