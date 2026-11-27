export const nationalBudgetModel = {
  version: 1,
  unit: 'points de PIB',
  resultUnit: '% du PIB',
  precision: 100,
  maxChange: 10,
  assumption: 'PIB et autres postes maintenus à leur niveau de référence.',
};

// Store ratios as hundredths of a point to keep the balance exact at this precision.
export function nationalBudgetScenario(baseline, changes) {
  const { precision, maxChange } = nationalBudgetModel;
  const valid = (value, min, max) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    Math.abs(value * precision - Math.round(value * precision)) < 1e-9;
  if (
    !baseline ||
    !changes ||
    !valid(baseline.revenue, 0, 100) ||
    !valid(baseline.spending, 0, 100) ||
    !valid(changes.revenue, -maxChange, maxChange) ||
    !valid(changes.spending, -maxChange, maxChange)
  )
    return null;
  const revenue =
    Math.round(baseline.revenue * precision) +
    Math.round(changes.revenue * precision);
  const spending =
    Math.round(baseline.spending * precision) +
    Math.round(changes.spending * precision);
  if (revenue < 0 || spending < 0) return null;
  return {
    revenue: revenue / precision,
    spending: spending / precision,
    balance: (revenue - spending) / precision,
  };
}
