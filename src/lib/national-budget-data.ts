import { sourceCommit } from '../../scripts/release-revision.mjs';
import { budget, sourceById } from './data';
import {
  nationalBudgetModel,
  nationalBudgetScenario,
} from './national-budget.mjs';

const baseline = {
  revenue: budget.values.revenue,
  spending: budget.values.spending,
};
const source = sourceById(budget.sourceId);
const noChange = { revenue: 0, spending: 0 };
const accounts = nationalBudgetScenario(baseline, noChange);
if (!accounts || accounts.balance !== -budget.values.deficit)
  throw Error(
    'Les comptes publics de référence ne donnent pas le solde publié.',
  );

export const nationalBudget = {
  version: 1,
  sourceCommit,
  items: [
    {
      id: 'comptes-publics-reference',
      title: `Comptes publics de ${budget.year}`,
      year: budget.year,
      date: budget.published,
      status: budget.status,
      unit: budget.unit,
      scope: budget.scope,
      values: accounts,
      source: { title: source.title, url: source.url },
    },
    {
      id: 'modele-variation-pib',
      title: 'Effet illustratif d’une variation des recettes et des dépenses',
      ...nationalBudgetModel,
      formulas: {
        revenue: 'recettes de référence + variation de recettes',
        spending: 'dépenses de référence + variation de dépenses',
        balance: 'recettes du scénario - dépenses du scénario',
      },
      examples: [
        noChange,
        { revenue: 0, spending: 0.5 },
        { revenue: 0.3, spending: -0.2 },
      ].map((changes) => ({
        changes,
        values: nationalBudgetScenario(baseline, changes),
      })),
    },
  ],
};
