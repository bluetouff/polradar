import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nationalBudgetScenario } from '../src/lib/national-budget.mjs';
import budget from '../src/data/budget.json' with { type: 'json' };

test('le budget de référence et les écarts conservent leur précision et leur signe', () => {
  assert.equal(
    nationalBudgetScenario(budget.values, { spending: 0, revenue: 0 }).balance,
    -budget.values.deficit,
  );
  assert.deepEqual(
    nationalBudgetScenario(budget.values, { spending: -0.2, revenue: 0.3 }),
    {
      revenue: 52.5,
      spending: 57.1,
      balance: -4.6,
    },
  );
  assert.equal(
    nationalBudgetScenario(budget.values, { spending: 10, revenue: -10 })
      .balance,
    -25.1,
  );
});

test('le calcul refuse une donnée manquante, une précision excessive et une variation hors limites', () => {
  for (const revenue of [undefined, null, '1', 0.001, 10.01, Infinity]) {
    assert.equal(
      nationalBudgetScenario(budget.values, { spending: 0, revenue }),
      null,
    );
  }
  assert.equal(nationalBudgetScenario(null, { spending: 0, revenue: 0 }), null);
  assert.equal(
    nationalBudgetScenario(
      { spending: 1, revenue: 1 },
      { spending: -2, revenue: 0 },
    ),
    null,
  );
});
