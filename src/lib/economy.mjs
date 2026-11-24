import { z } from 'astro/zod';
import {
  civilDateInParis,
  dateSchema,
  idSchema,
  publicUrlSchema,
} from './schema.mjs';

export const economyGroups = {
  prix: { label: 'Prix', icon: 'euro' },
  emploi: { label: 'Emploi', icon: 'travail' },
  activite: { label: 'Activité', icon: 'markets' },
  'niveau-de-vie': { label: 'Revenus et épargne', icon: 'euro' },
  finances: { label: 'Finances publiques', icon: 'fiscalite' },
};

const decimal = z.string().regex(/^-?\d{1,13}(?:\.\d{1,10})?$/);
const stamp = z.iso.datetime({ offset: true });
const text = z.string().trim().min(1).max(1200);
const periodPatterns = {
  A: /^20\d{2}$/,
  Q: /^20\d{2}-Q[1-4]$/,
  M: /^20\d{2}-(0[1-9]|1[0-2])$/,
};

export const seriesConfigSchema = z
  .array(
    z.strictObject({
      id: idSchema,
      group: z.enum([
        'prix',
        'emploi',
        'activite',
        'niveau-de-vie',
        'finances',
      ]),
      title: text,
      description: text,
      frequency: z.enum(['A', 'Q', 'M']),
      unit: z.enum(['%', '% du PIB', 'M€']),
      dataset: z.string().regex(/^[a-z0-9_]{1,50}$/),
      filters: z.record(
        z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
        z.string().regex(/^[A-Z0-9_+.-]{1,32}$/),
      ),
    }),
  )
  .min(1)
  .max(40);

export const economySchema = z.strictObject({
  collectedAt: stamp,
  since: z.number().int().min(2000).max(2099),
  series: z
    .array(
      z.strictObject({
        id: idSchema,
        updatedAt: stamp,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        observations: z
          .array(
            z.tuple([
              z.string().max(8),
              decimal.nullable(),
              z.string().regex(/^[a-z: ]{0,18}$/),
            ]),
          )
          .min(1)
          .max(300),
      }),
    )
    .min(1)
    .max(40),
});

const source = z.strictObject({
  title: text,
  url: publicUrlSchema,
  date: z
    .union([dateSchema, z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)])
    .nullable(),
});
export const statementsSchema = z
  .array(
    z.strictObject({
      id: idSchema,
      title: text,
      speaker: text,
      candidate: idSchema.optional(),
      theme: idSchema.optional(),
      quote: text.max(420),
      statement: source,
      period: text,
      unit: z.enum(['%', '% du PIB', 'TWh', 'Md€', 'millions de personnes']),
      claimed: decimal,
      observed: decimal,
      reference: source,
      assessment: z.enum(['comparable', 'revision', 'perimetre', 'arrondi']),
      context: text,
      priorReference: source.optional(),
      indicatorId: idSchema.optional(),
    }),
  )
  .min(1)
  .max(50);

export function validateEconomy(
  config,
  snapshot,
  statements,
  now = new Date(),
) {
  const errors = [];
  const captured = new Date(snapshot.collectedAt).getTime();
  const today = civilDateInParis(now);
  const asOf = civilDateInParis(new Date(captured));
  const month = Number(asOf.slice(5, 7));
  const latest = {
    A: asOf.slice(0, 4),
    Q: asOf.slice(0, 4) + '-Q' + Math.ceil(month / 3),
    M: asOf.slice(0, 7),
  };
  const definitions = new Map(config.map((row) => [row.id, row]));
  const served = new Set();
  if (captured > now.getTime())
    errors.push('Indicateurs : horodatage de collecte futur.');
  if (definitions.size !== config.length)
    errors.push('Indicateurs : définition dupliquée.');
  for (const series of snapshot.series) {
    const definition = definitions.get(series.id);
    if (!definition || served.has(series.id)) {
      errors.push(`${series.id} : série inconnue ou dupliquée.`);
      continue;
    }
    served.add(series.id);
    if (new Date(series.updatedAt).getTime() > captured)
      errors.push(`${series.id} : source postérieure à la collecte.`);
    const { frequency, filters } = definition;
    if (
      Object.hasOwn(filters, 'freq') ||
      Object.hasOwn(filters, 'geo') ||
      !series.observations.some(([, value]) => value !== null) ||
      series.observations.some(
        ([period], index, points) =>
          !periodPatterns[frequency].test(period) ||
          period < String(snapshot.since) ||
          period > latest[frequency] ||
          (index > 0 && period <= points[index - 1][0]),
      )
    )
      errors.push(`${series.id} : observations hors champ ou désordonnées.`);
  }
  if (served.size !== definitions.size)
    errors.push('Indicateurs : relevé incomplet.');

  const ids = new Set();
  for (const row of statements) {
    const dates = [
      row.statement.date,
      row.reference.date,
      row.priorReference?.date,
    ];
    if (
      ids.has(row.id) ||
      (row.assessment === 'arrondi' &&
        !matchesRounding(row.claimed, row.observed)) ||
      dates.some((date) => date && date > today) ||
      (row.indicatorId && !definitions.has(row.indicatorId)) ||
      (row.assessment === 'revision') !== Boolean(row.priorReference) ||
      (row.priorReference &&
        (!row.priorReference.date ||
          !row.reference.date ||
          row.priorReference.date >= row.reference.date))
    ) {
      errors.push(`${row.id} : vérification de déclaration incohérente.`);
    }
    ids.add(row.id);
  }
  return errors;
}

const unitReadings = {
  RCH_A: '% sur un an',
  PCH_SM: '% sur un an',
  PC_ACT: '% des actifs',
  PC_POP: '% de la population de cet âge',
  CLV_PCH_PRE: '% sur un trimestre',
};
export function economyUnitLabel(series) {
  if (series.id === 'revenu-reel') return '% sur un trimestre';
  if (series.id === 'epargne-menages') return '% du revenu disponible';
  return unitReadings[series.filters.unit] ?? series.unit;
}
const flags = {
  b: 'rupture de série',
  d: 'définition différente',
  p: 'provisoire',
  e: 'estimation',
};
export function observationFlag(raw) {
  return raw
    .trim()
    .split(/ +/)
    .filter(Boolean)
    .map((flag) => flags[flag] ?? 'statut Eurostat ' + flag)
    .join(', ');
}
export const frequencyLabels = { A: 'Annuel', M: 'Mensuel', Q: 'Trimestriel' };

export function eurostatLinks(series, since) {
  const selectors = { ...series.filters, freq: series.frequency, geo: 'FR' };
  return {
    table: `https://ec.europa.eu/eurostat/databrowser/view/${series.dataset}/default/table?lang=fr`,
    api: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${series.dataset}?${new URLSearchParams(
      [
        ['lang', 'FR'],
        ['sinceTimePeriod', String(since)],
        ...Object.entries(selectors).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ],
    )}`,
  };
}

export function labelPeriod(period) {
  if (period.includes('-Q')) return `T${period.at(-1)} ${period.slice(0, 4)}`;
  if (period.length === 4) return period;
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}-01T12:00:00Z`));
}

export function printedNumber(value) {
  const digits = value.split('.')[1]?.length ?? 0;
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const ordinal = (period, frequency) => {
  const year = Number(period.slice(0, 4));
  if (frequency === 'A') return year;
  return (
    year * (frequency === 'M' ? 12 : 4) +
    Number(period.slice(frequency === 'M' ? 5 : 6))
  );
};

export function economyCurve(points, frequency, width, height, margin = 5) {
  const numbers = points.flatMap(([, value]) =>
    value === null ? [] : [Number(value)],
  );
  if (!numbers.length) return null;
  const first = ordinal(points[0][0], frequency);
  const last = ordinal(points.at(-1)[0], frequency);
  const floor = Math.min(...numbers);
  const ceiling = Math.max(...numbers);
  const lower = Math.min(floor, ceiling - 0.01);
  const y = (value) =>
    margin + ((ceiling - value) * (height - 2 * margin)) / (ceiling - lower);
  /** @type {Array<Array<{x:number,y:number,period:string,value:string,flag:string}>>} */
  const segments = [];
  let previous = null;
  for (const [period, value, flag] of points) {
    if (value === null) {
      previous = null;
      continue;
    }
    const tick = ordinal(period, frequency);
    const point = {
      x:
        margin +
        ((tick - first) * (width - 2 * margin)) / Math.max(1, last - first),
      y: y(Number(value)),
      period,
      value,
      flag,
    };
    if (previous !== tick - 1) segments.push([]);
    segments.at(-1).push(point);
    previous = tick;
  }
  const latest = segments.at(-1)?.at(-1);
  if (!latest) return null;
  return {
    segments,
    top: String(ceiling),
    bottom: String(floor),
    zero: lower < 0 && ceiling > 0 ? y(0) : null,
    latest,
  };
}

export function decimalDifference(left, right) {
  const places = Math.max(
    left.split('.')[1]?.length ?? 0,
    right.split('.')[1]?.length ?? 0,
  );
  const integer = (value) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole + fraction.padEnd(places, '0'));
  };
  const diff = integer(left) - integer(right);
  const digits = (diff < 0n ? -diff : diff)
    .toString()
    .padStart(places + 1, '0');
  const absolute =
    places === 0
      ? digits
      : digits.slice(0, -places) + '.' + digits.slice(-places);
  return (diff < 0n ? '-' : '') + absolute;
}

// Compare decimal strings at the precision actually used in the quotation.
function matchesRounding(claimed, observed) {
  const places = claimed.split('.')[1]?.length ?? 0;
  const [whole, fraction = ''] = observed.replace(/^-/, '').split('.');
  if (fraction.length <= places) return false;
  let rounded = BigInt(whole + fraction.slice(0, places));
  if (fraction[places] >= '5') rounded += 1n;
  return (
    (observed.startsWith('-') ? -rounded : rounded) ===
    BigInt(claimed.replace('.', ''))
  );
}

export function statementResult(row) {
  if (
    row.assessment === 'arrondi' &&
    matchesRounding(row.claimed, row.observed)
  )
    return { label: 'Concorde à l’arrondi', tone: 'match', delta: null };
  if (row.assessment === 'perimetre')
    return { label: 'Périmètre à préciser', tone: 'scope', delta: null };
  const delta = decimalDifference(row.claimed, row.observed);
  if (row.assessment === 'revision')
    return { label: 'Chiffre révisé', tone: 'revision', delta };
  return {
    label: Number(delta) === 0 ? 'Concorde' : 'Écart constaté',
    tone: Number(delta) === 0 ? 'match' : 'gap',
    delta,
  };
}
