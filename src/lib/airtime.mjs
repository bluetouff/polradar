import { z } from 'astro/zod';
import { idSchema, dateSchema, publicUrlSchema } from './schema.mjs';

// Exact, editorially checked matches. Similar surnames never identify a person.
export const airtimeAliases = {
  arthaud: 'ARTHAUD Nathalie',
  asselineau: 'ASSELINEAU François',
  attal: 'ATTAL Gabriel',
  'dupont-aignan': 'DUPONT-AIGNAN Nicolas',
  glucksmann: 'GLUCKSMANN Raphaël',
  lassalle: 'LASSALLE Jean',
  lepen: 'LE PEN Marine',
  lisnard: 'LISNARD David',
  melenchon: 'MELENCHON Jean-Luc',
  mlekuz: 'MLEKUZ MANOLO',
  philippe: 'PHILIPPE Edouard',
  philippot: 'PHILIPPOT Florian',
  polony: 'POLONY Natacha',
  retailleau: 'RETAILLEAU Bruno',
  roussel: 'ROUSSEL Fabien',
  ruffin: 'RUFFIN François',
  tondelier: 'TONDELIER Marine',
  zemmour: 'ZEMMOUR Eric',
};
const seconds = z
  .number()
  .int()
  .nonnegative()
  .max(31 * 86400);
const observation = z.object({
  candidate: idSchema,
  seconds: seconds.nullable(),
  publishedCells: z.number().int().min(0).max(3),
});
const service = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(['television', 'radio']),
  totalSeconds: seconds.nullable(),
  publishedCells: z.number().int().nonnegative(),
  observations: z.array(observation),
});
export const airtimeSchema = z
  .object({
    version: z.literal(1),
    checked: dateSchema,
    months: z
      .array(
        z.object({
          month: z.string().regex(/^202[5-9]-(0[1-9]|1[0-2])$/),
          sourceUrl: publicUrlSchema.refine(
            (s) => new URL(s).hostname === 'www.arcom.fr',
          ),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          services: z.array(service).min(1).max(100),
        }),
      )
      .min(1)
      .max(60),
  })
  .superRefine((snapshot, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    if (
      new Set(snapshot.months.map((m) => m.month)).size !==
      snapshot.months.length
    )
      fail('Mois dupliqué');
    for (const month of snapshot.months) {
      if (month.month >= snapshot.checked.slice(0, 7))
        fail('Période incomplète ou future');
      if (
        new Set(month.services.map((s) => s.name)).size !==
        month.services.length
      )
        fail('Service dupliqué');
      for (const row of month.services) {
        if ((row.totalSeconds === null) !== (row.publishedCells === 0))
          fail('Une absence de relevé reste inconnue');
        if (
          new Set(row.observations.map((o) => o.candidate)).size !==
          row.observations.length
        )
          fail('Personnalité dupliquée');
        for (const o of row.observations) {
          if (!Object.hasOwn(airtimeAliases, o.candidate))
            fail('Identité non qualifiée');
          if ((o.seconds === null) !== (o.publishedCells === 0))
            fail('Un tiret ne vaut pas zéro');
        }
        const sum = row.observations.reduce((n, o) => n + (o.seconds ?? 0), 0);
        if (sum > (row.totalSeconds ?? 0))
          fail('Les parties dépassent le relevé');
      }
    }
  });

/** Strict CSV reader: quoted semicolons/newlines and escaped quotes, bounded input. */
export function readArcomCsv(text) {
  if (typeof text !== 'string' || text.length > 2000000)
    throw new Error('CSV trop volumineux');
  const rows = [];
  let row = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ';') {
      row.push(field);
      field = '';
      closed = false;
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      closed = false;
    } else if (c !== '\r') {
      if (closed || c === '"') throw new Error('CSV mal formé');
      field += c;
    }
  }
  if (quoted) throw new Error('Citation CSV incomplète');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 1 || rows.length > 10000)
    throw new Error('Nombre de lignes invalide');
  return rows;
}
export function durationSeconds(value) {
  if (value === '-') return null;
  if (!/^\d{2,3}:[0-5]\d:[0-5]\d$/.test(value))
    throw new Error('Durée Arcom invalide');
  const [h, m, s] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
export function compileArcom(text) {
  const parsed = readArcomCsv(text.replace(/^\uFEFF/, ''));
  if (parsed.length < 4) throw new Error('Relevé incomplet');
  const [names, kinds, genres, ...people] = parsed;
  if (
    names[1] !== 'Appartenance' ||
    kinds[0] !== 'Type de service' ||
    genres[0] !== "Type d'émission" ||
    (names.length - 2) % 3
  )
    throw new Error('En-tête Arcom inconnu');
  if ([kinds, genres, ...people].some((r) => r.length !== names.length))
    throw new Error('Colonnes incohérentes');
  const services = [];
  for (let col = 2; col < names.length; col += 3) {
    const name = names[col];
    if (
      !name ||
      names.slice(col, col + 3).some((n) => n !== name) ||
      genres.slice(col, col + 3).join(',') !== 'JTF,MAG,PROG' ||
      kinds.slice(col, col + 3).some((k) => k !== kinds[col])
    )
      throw new Error('Grain Arcom modifié');
    if (
      !['Radio', 'Chaîne généraliste', "Chaîne d'information"].includes(
        kinds[col],
      )
    )
      throw new Error('Type de service inconnu');
    const values = people
      .flatMap((r) => r.slice(col, col + 3).map(durationSeconds))
      .filter((v) => v !== null);
    const observations = Object.entries(airtimeAliases).map(
      ([candidate, alias]) => {
        const matches = people.filter((r) => r[0] === alias);
        if (matches.length > 1) throw new Error('Identité Arcom ambiguë');
        const durations = matches
          .flatMap((r) => r.slice(col, col + 3).map(durationSeconds))
          .filter((v) => v !== null);
        return {
          candidate,
          seconds: durations.length
            ? durations.reduce((a, b) => a + b, 0)
            : null,
          publishedCells: durations.length,
        };
      },
    );
    services.push({
      name,
      kind: kinds[col] === 'Radio' ? 'radio' : 'television',
      totalSeconds: values.length ? values.reduce((a, b) => a + b, 0) : null,
      publishedCells: values.length,
      observations,
    });
  }
  return services;
}
