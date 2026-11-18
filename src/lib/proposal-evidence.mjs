import { z } from 'astro/zod';
import { idSchema, dateSchema, publicUrlSchema } from './schema.mjs';
const text = z.string().min(1).max(1600);
const state = z.strictObject({
  id: idSchema,
  trackId: idSchema,
  date: z.strictObject({
    value: z.union([dateSchema, z.string().regex(/^20\d{2}$/)]),
    kind: z.enum([
      'edition',
      'publication',
      'declaration',
      'consultation',
      'mise-a-jour',
    ]),
  }),
  edition: text,
  scope: z.enum(['archive', 'parti', 'campagne']),
  observedOn: dateSchema,
  recordedAt: z.iso.datetime(),
  value: z.number().positive().max(1e13),
  unit: z.enum(['euros-net-mois', 'euros-mois', 'euros', 'ans']),
  basisKey: idSchema,
  population: text,
  statement: text,
  parameters: z.array(z.strictObject({ label: text, value: text })).max(8),
  reported: z.boolean(),
  source: z.strictObject({
    id: idSchema,
    title: text,
    url: publicUrlSchema,
    authority: z.enum(['institution', 'parti', 'campagne']),
    published: dateSchema.nullable(),
    updated: dateSchema.nullable(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    quote: z.string().min(1).max(400),
    locator: text,
  }),
});
export const evolutionSchema = z.strictObject({
  version: z.literal(1),
  checked: dateSchema,
  tracks: z
    .array(
      z.strictObject({
        id: idSchema,
        candidate: idSchema,
        theme: idSchema,
        title: text,
        kind: z.enum(['montant', 'conditions', 'perimetre', 'maintien']),
        note: text,
        stateIds: z.array(idSchema).min(2).max(30),
        measureIds: z.array(idSchema).max(20),
      }),
    )
    .min(1),
  states: z.array(state).min(2),
});
export const financingSchema = z.strictObject({
  version: z.literal(1),
  checked: dateSchema,
  maps: z
    .array(
      z.strictObject({
        id: idSchema,
        candidate: idSchema,
        budgetEntry: idSchema,
        relation: z.enum([
          'affectation',
          'composition',
          'financement',
          'non-chiffree',
        ]),
        title: text,
        note: text,
        origin: z
          .strictObject({
            label: text,
            detail: text,
            qualifier: text.nullable(),
          })
          .nullable(),
        assumptions: z.array(text).max(8),
      }),
    )
    .min(1),
});
/** Cross-references and temporal precision are checked independently of presentation. */
export function validateProposalReferences(
  evolution,
  financing,
  dataset,
  budgets,
  now = new Date(),
) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const unique = (rows, label) => {
    if (new Set(rows).size !== rows.length) fail(`${label} : doublon`);
  };
  unique(
    evolution.tracks.map((t) => t.id),
    'Dossiers',
  );
  unique(
    evolution.states.map((s) => s.id),
    'États',
  );
  unique(
    financing.maps.map((m) => m.id),
    'Cartes',
  );
  const civil = (date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  const today = civil(now);
  if (evolution.checked > today || financing.checked > today)
    fail('Consultation future');
  const people = new Set(dataset.candidates.map((c) => c.id));
  const themes = new Set(dataset.themes.map((t) => t.id));
  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  const measures = new Map(dataset.measures.map((m) => [m.id, m]));
  const assigned = [];
  const official = (id) => {
    const source = sources.get(id);
    return (
      source &&
      (['institution', 'parti', 'campagne'].includes(source.kind) ||
        (source.kind === 'archive' &&
          ['www.cnccep.fr', 'melenchon2027.fr'].includes(
            new URL(source.url).hostname,
          )))
    );
  };
  for (const track of evolution.tracks) {
    if (!people.has(track.candidate) || !themes.has(track.theme))
      fail(`${track.id} : candidat ou thème inconnu`);
    unique(track.stateIds, track.id);
    const states = track.stateIds.map((id) =>
      evolution.states.find((s) => s.id === id),
    );
    assigned.push(...track.stateIds);
    for (const s of states)
      if (!s || s.trackId !== track.id)
        fail(`${track.id} : état manquant ou mal rattaché`);
    const known = states.filter(Boolean);
    if (
      track.kind === 'maintien' &&
      new Set(known.map((s) => s.value)).size !== 1
    )
      fail(`${track.id} : paramètre modifié présenté comme maintenu`);
    if (
      ['montant', 'maintien'].includes(track.kind) &&
      new Set(known.map((s) => `${s.unit}/${s.basisKey}`)).size !== 1
    )
      fail(`${track.id} : bases incompatibles`);
    if (known.some((s, i) => i && s.date.value < known[i - 1].date.value))
      fail(`${track.id} : ordre chronologique invalide`);
    for (const id of track.measureIds)
      if (
        measures.get(id)?.candidate !== track.candidate ||
        measures.get(id)?.theme !== track.theme
      )
        fail(`${track.id} : mesure mal rattachée`);
  }
  unique(assigned, 'Affectation des états');
  for (const s of evolution.states) {
    if (
      ![
        'www.cnccep.fr',
        'melenchon2027.fr',
        'www.edouardphilippe.fr',
        'www.unenouvelleenergie.fr',
        'www.lutte-ouvriere.org',
        'www.pcf.fr',
      ].includes(new URL(s.source.url).hostname)
    )
      fail(`${s.id} : domaine historique non qualifié`);
    if (!assigned.includes(s.id) || !official(s.source.id))
      fail(`${s.id} : référence officielle manquante`);
    const global = sources.get(s.source.id);
    if (
      global &&
      s.source.authority !==
        (global.kind === 'archive'
          ? new URL(s.source.url).hostname === 'www.cnccep.fr'
            ? 'institution'
            : 'parti'
          : global.kind)
    )
      fail(`${s.id} : attribution incohérente`);
    if (s.date.value.length === 4 && s.date.kind !== 'edition')
      fail(`${s.id} : précision de date insuffisante`);
    if (
      s.date.value > s.observedOn ||
      s.observedOn > evolution.checked ||
      new Date(s.recordedAt) > now ||
      civil(new Date(s.recordedAt)) < s.observedOn
    )
      fail(`${s.id} : date future ou incohérente`);
    if (s.date.kind === 'consultation' && s.date.value !== s.observedOn)
      fail(`${s.id} : consultation incohérente`);
    if (s.date.kind === 'publication' && s.date.value !== s.source.published)
      fail(`${s.id} : publication incohérente`);
    if (s.date.kind === 'mise-a-jour' && s.date.value !== s.source.updated)
      fail(`${s.id} : mise à jour incohérente`);
    if (
      [s.source.published, s.source.updated].some((d) => d && d > s.observedOn)
    )
      fail(`${s.id} : document futur`);
    if (s.source.quote.trim().split(/\s+/).length > 25)
      fail(`${s.id} : extrait trop long`);
  }
  // A source's full frozen URL is part of its historical identity. No dynamic redirect is followed here.
  const quotes = new Map();
  for (const s of evolution.states) {
    const q = quotes.get(s.source.url) ?? new Set();
    q.add(s.source.quote);
    quotes.set(s.source.url, q);
  }
  for (const q of quotes.values())
    if ([...q].join(' ').split(/\s+/).length > 25)
      fail('Extraits cumulés trop longs pour une source');
  const entries = new Map(
    budgets.profiles.flatMap((p) =>
      p.entries.map((e) => [e.id, { ...e, candidate: p.candidate }]),
    ),
  );
  for (const map of financing.maps) {
    const e = entries.get(map.budgetEntry);
    if (!e || e.candidate !== map.candidate) {
      fail(`${map.id} : montant mal rattaché`);
      continue;
    }
    for (const id of [e.source, ...(e.additionalSources ?? [])])
      if (!official(id)) fail(`${map.id} : source officielle manquante`);
    if (['affectation', 'composition'].includes(map.relation)) {
      if (!e.allocation.length || map.origin)
        fail(`${map.id} : répartition manquante`);
    } else if (!map.origin || e.allocation.length)
      fail(`${map.id} : origine manquante`);
    if (
      map.relation === 'financement' &&
      (e.kind !== 'financement' || map.origin?.qualifier)
    )
      fail(`${map.id} : financement non chiffré`);
    if (
      map.relation === 'non-chiffree' &&
      (!e.funding || !map.origin?.qualifier)
    )
      fail(`${map.id} : absence de chiffrage non explicite`);
    for (const label of map.assumptions)
      if (!e.allocation.some((a) => a.label === label))
        fail(`${map.id} : hypothèse inconnue`);
  }
  return errors;
}
