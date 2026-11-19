import { z } from 'astro/zod';
import {
  idSchema,
  dateSchema,
  publicUrlSchema,
  civilDateInParis,
} from './schema.mjs';
const text = z.string().trim().min(1).max(1800);
const count = z.number().int().nonnegative().max(1500);
const choice = z.enum(['pour', 'contre', 'abstention', 'non-votant']);
const reference = z.strictObject({ title: text, url: publicUrlSchema });
export const legislativeVotesSchema = z.strictObject({
  version: z.literal(1),
  checked: dateSchema,
  ballots: z
    .array(
      z.strictObject({
        id: idSchema,
        chamber: z.enum(['assemblee', 'senat', 'parlement-europeen']),
        term: text,
        number: z.number().int().positive(),
        date: dateSchema,
        dateKind: z.literal('seance'),
        title: text,
        shortTitle: text,
        kind: z.enum([
          'declaration',
          'article',
          'amendement',
          'ensemble',
          'motion-rejet',
          'motion-censure',
        ]),
        decision: z.enum(['adopte', 'rejete']),
        context: text,
        tally: z.strictObject({
          voters: count.positive(),
          expressed: count,
          for: count,
          against: count.nullable(),
          abstained: count.nullable(),
          majority: count.positive().nullable(),
          nonVoters: count.nullable(),
        }),
        source: z.strictObject({
          url: publicUrlSchema,
          title: text,
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          checkedAt: z.iso.datetime({ offset: true }),
          locator: text,
        }),
        documents: z.array(reference).min(1).max(5),
        positions: z
          .array(
            z.strictObject({
              candidate: idSchema,
              officialName: text,
              officialId: z
                .string()
                .regex(/^[A-Za-z0-9_-]+$/)
                .nullable(),
              profileUrl: publicUrlSchema.nullable(),
              choice,
              groupAtTime: text,
            }),
          )
          .min(1)
          .max(40),
        rectification: text.nullable(),
      }),
    )
    .min(1)
    .max(500),
  cases: z
    .array(
      z.strictObject({
        id: idSchema,
        candidate: idSchema,
        measureId: idSchema,
        versionId: idSchema,
        title: text,
        note: text,
        links: z
          .array(
            z.strictObject({
              ballotId: idSchema,
              relation: z.enum(['meme-objet', 'texte-plus-large']),
              context: text,
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(1000),
});

const normalizedName = (s) =>
  s
    .replace(/^(?:M\.|Mme|MM\.)\s*/u, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const chamberHosts = {
  assemblee: new Set([
    'www.assemblee-nationale.fr',
    'questions.assemblee-nationale.fr',
    'www2.assemblee-nationale.fr',
  ]),
  senat: new Set(['www.senat.fr', 'extranet.senat.fr']),
  'parlement-europeen': new Set(['www.europarl.europa.eu']),
};
export function validateLegislativeReferences(data, dataset, now = new Date()) {
  const errors = [],
    fail = (s) => errors.push(s);
  const unique = (rows, label) => {
    if (new Set(rows).size !== rows.length) fail(`${label} : doublon`);
  };
  unique(
    data.ballots.map((b) => b.id),
    'Scrutins',
  );
  unique(
    data.cases.map((c) => c.id),
    'Dossiers',
  );
  const today = civilDateInParis(now);
  if (data.checked > today) fail('Consultation future');
  const people = new Map(dataset.candidates.map((c) => [c.id, c]));
  const measures = new Map(dataset.measures.map((m) => [m.id, m]));
  const versions = new Map(dataset.versions.map((v) => [v.id, v]));
  const ballots = new Map(data.ballots.map((b) => [b.id, b]));
  const assigned = new Set();
  for (const b of data.ballots) {
    if (b.kind === 'motion-censure') {
      if (
        b.tally.for !== b.tally.voters ||
        b.tally.for !== b.tally.expressed ||
        b.tally.against !== null ||
        b.tally.abstained !== null ||
        b.positions.some((p) => p.choice !== 'pour')
      )
        fail(`${b.id} : la censure ne recense que les voix favorables`);
    } else if (
      b.tally.against === null ||
      b.tally.abstained === null ||
      b.tally.for + b.tally.against !== b.tally.expressed ||
      b.tally.expressed + b.tally.abstained !== b.tally.voters
    )
      fail(`${b.id} : décompte incohérent`);
    if (
      b.tally.majority !== null &&
      b.tally.for >= b.tally.majority !== (b.decision === 'adopte')
    )
      fail(`${b.id} : décision incompatible avec la majorité publiée`);
    const checked = new Date(b.source.checkedAt);
    if (
      checked > now ||
      b.date > civilDateInParis(checked) ||
      civilDateInParis(checked) > data.checked
    )
      fail(`${b.id} : dates incohérentes`);
    for (const ref of [b.source, ...b.documents])
      if (!chamberHosts[b.chamber].has(new URL(ref.url).hostname))
        fail(`${b.id} : domaine institutionnel incohérent`);
    unique(
      b.positions.map((p) => p.candidate),
      b.id,
    );
    for (const p of b.positions) {
      if (
        !people.has(p.candidate) ||
        normalizedName(p.officialName) !==
          normalizedName(people.get(p.candidate).name)
      )
        fail(`${b.id} : identité nominative incohérente`);
      if ((p.officialId === null) !== (p.profileUrl === null))
        fail(`${b.id} : identité officielle incomplète`);
      if (
        p.profileUrl &&
        (!chamberHosts[b.chamber].has(new URL(p.profileUrl).hostname) ||
          !new URL(p.profileUrl).pathname
            .split('/')
            .some((s) => s.replace(/\.html$/, '') === p.officialId))
      )
        fail(`${b.id} : profil officiel incohérent`);
    }
    for (const [value, key] of [
      ['pour', 'for'],
      ['contre', 'against'],
      ['abstention', 'abstained'],
      ['non-votant', 'nonVoters'],
    ]) {
      const n = b.positions.filter((p) => p.choice === value).length;
      if (n && (b.tally[key] === null || n > b.tally[key]))
        fail(`${b.id} : positions incompatibles avec les totaux`);
    }
  }
  for (const c of data.cases) {
    const m = measures.get(c.measureId),
      v = versions.get(c.versionId);
    if (!m || m.candidate !== c.candidate || !v || v.measureId !== c.measureId)
      fail(`${c.id} : proposition ou version incohérente`);
    unique(
      c.links.map((l) => l.ballotId),
      c.id,
    );
    for (const link of c.links) {
      const b = ballots.get(link.ballotId);
      if (b && v && b.date > v.snapshot.checked)
        fail(`${c.id} : scrutin postérieur à la proposition consultée`);
      assigned.add(link.ballotId);
      if (!b || !b.positions.some((p) => p.candidate === c.candidate))
        fail(`${c.id} : position nominative manquante`);
      if (
        b &&
        ['ensemble', 'declaration', 'motion-rejet', 'motion-censure'].includes(
          b.kind,
        ) &&
        link.relation !== 'texte-plus-large'
      )
        fail(`${c.id} : portée du scrutin masquée`);
    }
  }
  for (const b of data.ballots)
    if (!assigned.has(b.id)) fail(`${b.id} : scrutin sans dossier`);
  return errors;
}

export const ballotKinds = {
  declaration: 'Déclaration du Gouvernement',
  article: 'Article',
  amendement: 'Amendement',
  ensemble: 'Ensemble du texte',
  'motion-rejet': 'Motion de rejet',
  'motion-censure': 'Motion de censure',
};
export const chambers = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
  'parlement-europeen': 'Parlement européen',
};
export function decisionLabel(ballot) {
  const adopted = ballot.decision === 'adopte';
  if (ballot.kind === 'declaration')
    return adopted ? 'Déclaration approuvée' : 'Déclaration rejetée';
  if (ballot.kind.startsWith('motion-'))
    return adopted ? 'Motion adoptée' : 'Motion rejetée';
  const subject =
    ballot.kind === 'ensemble' ? 'Texte' : ballotKinds[ballot.kind];
  return `${subject} ${adopted ? 'adopté' : 'rejeté'}`;
}
export function positionLabel(position, ballot) {
  if (position.choice === 'abstention') return 'Abstention';
  if (position.choice === 'non-votant') return 'Non-votant indiqué';
  const object = ballot.kind.startsWith('motion-')
    ? 'la motion'
    : ballot.kind === 'declaration'
      ? 'la déclaration'
      : ballot.kind === 'article'
        ? 'l’article'
        : ballot.kind === 'amendement'
          ? 'l’amendement'
          : 'le texte';
  return `${position.choice === 'pour' ? 'Pour' : 'Contre'} ${object}`;
}
export function ballotDots(ballot) {
  const columns = 24,
    gap = 9;
  const choices = [
    ...Array(ballot.tally.for).fill('pour'),
    ...Array(ballot.tally.against ?? 0).fill('contre'),
    ...Array(ballot.tally.abstained ?? 0).fill('abstention'),
  ];
  return {
    width: 228,
    height: Math.max(30, Math.ceil(choices.length / columns) * gap + 10),
    dots: choices.map((choice, i) => ({
      choice,
      x: 8 + (i % columns) * gap,
      y: 8 + Math.floor(i / columns) * gap,
    })),
  };
}
