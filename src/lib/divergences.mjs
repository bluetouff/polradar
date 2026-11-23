import { metricGroups } from './features.mjs';

/**
 * @param {import('./data').Measure[]} measures
 * @param {import('./data').Candidate[]} candidates
 * @param {Array<{id:string,label:string}>} themes
 * @returns {Array<{id:string,theme:string,themeLabel:string,key:string,label:string,unit:string,values:Array<{candidate:string,name:string,value:number,measureId:string,measure:import('./data').Measure}>}>}
 */
export function divergenceGroups(measures, candidates, themes) {
  // Both keys describe the general retirement target. Keep hardship and
  // full-rate ages separate; they describe different conditions.
  const normalized = measures.map((measure) => {
    const metrics = measure.metrics.map((metric) => {
      if (
        measure.theme === 'retraites' &&
        metric.key === 'age-retraite' &&
        metric.unit === 'ans'
      )
        return { ...metric, key: 'age-depart', label: 'Âge de départ cible' };
      if (
        measure.theme === 'securite' &&
        ['places-prison', 'places-prison-supplementaires'].includes(
          metric.key,
        ) &&
        metric.unit === 'places'
      )
        return {
          ...metric,
          key: 'places-prison-supplementaires',
          label: 'Places de prison à construire',
        };
      return metric;
    });
    if (measure.theme === 'travail') {
      for (const amount of measure.amounts) {
        if (
          [
            'SMIC mensuel annoncé',
            'SMIC mensuel proposé',
            'SMIC proposé',
          ].includes(amount.label) &&
          amount.unit === '€' &&
          amount.period === 'mois' &&
          amount.basis === 'net'
        ) {
          metrics.push({
            key: 'smic-mensuel-net',
            label: 'SMIC mensuel net',
            unit: '€ nets / mois',
            value: amount.value,
            sourceId: amount.sourceId,
          });
        }
      }
    }
    return { ...measure, metrics };
  });
  return themes.flatMap((theme) => {
    const groups = metricGroups(
      normalized.filter((row) => row.theme === theme.id),
      candidates,
    );
    return groups.map((group) => ({
      ...group,
      id: `${theme.id}-${group.key}${groups.filter((row) => row.key === group.key).length > 1 ? '-unit-' + [...group.unit].map((char) => char.codePointAt(0).toString(36)).join('-') : ''}`,
      theme: theme.id,
      themeLabel: theme.label,
      values: group.values.map((row) => ({
        ...row,
        measure: measures.find((measure) => measure.id === row.measureId),
      })),
    }));
  });
}

/** @param {number} value @returns {string} */
export const formatMetricValue = (value) =>
  value.toLocaleString('fr-FR', { maximumSignificantDigits: 21 });

/** @param {number} value @param {string} unit @returns {string} */
export function formatDivergenceValue(value, unit) {
  const months = value * 12;
  if (unit === 'ans' && !Number.isInteger(value) && Number.isInteger(months))
    return `${Math.floor(value)} ans et ${months % 12} mois`;
  return `${formatMetricValue(value)} ${unit}`;
}

/** @param {Array<{value:number}>} values @param {number} width */
export function divergenceLayout(values, width) {
  if (
    !Number.isFinite(width) ||
    width < 180 ||
    width > 10000 ||
    values.length < 2 ||
    values.some((row) => !Number.isFinite(row.value) || row.value < 0)
  )
    throw new Error('Échelle non exploitable');
  const min = Math.min(...values.map((row) => row.value)),
    max = Math.max(...values.map((row) => row.value));
  let span = max - min;
  if (!Number.isFinite(span)) throw new Error('Écart non représentable');
  if (span === 0) span = Math.max(1, max * 0.1);
  const rough = span / 4,
    power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((n) => n * power >= rough) * power;
  let low = Math.max(
    0,
    Math.floor((min - (min === max ? span / 2 : 0)) / step) * step,
  );
  let high = Math.ceil((max + (min === max ? span / 2 : 0)) / step) * step;
  if (!(high > low) || !Number.isFinite(high) || !(step > 0))
    throw new Error('Échelle non représentable');
  const x = (value) => 38 + ((value - low) / (high - low)) * (width - 76);
  const placed = [];
  const points = values.map((row, index) => {
    const position = x(row.value);
    let lane = 0;
    while (
      placed.some(
        (point) => point.lane === lane && Math.abs(point.x - position) < 78,
      )
    )
      lane++;
    const point = { index, x: position, y: 48 + lane * 96, lane };
    placed.push(point);
    return point;
  });
  const axisY = Math.max(...points.map((point) => point.y)) + 70;
  let ticks = Array.from(
    { length: Math.min(9, Math.round((high - low) / step) + 1) },
    (_, index) => Number((low + index * step).toPrecision(12)),
  ).map((value) => ({ value, x: x(value) }));
  if (width < 400 && ticks.length > 2) ticks = [ticks[0], ticks.at(-1)];
  return { width, height: axisY + 42, axisY, points, ticks, low, high };
}
