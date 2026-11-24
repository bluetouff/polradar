import { createHash } from 'node:crypto';
import { candidates, themes } from './data';
import { archiveBallots, archiveMetadata } from './parliamentary-archives';
import { complementXVII, register } from './parliamentary-register';
import { senateRegister } from './senate-documents';
import { legislativeVotes, voteCases } from './votes-data';
import type {
  ActIndex,
  Mention,
  ParliamentaryAct,
} from './parliament-search-types';

const rows = new Map<string, ParliamentaryAct>();
const primarySources = new Map<string, string>();
const officialHosts = new Set([
  'www.assemblee-nationale.fr',
  'questions.assemblee-nationale.fr',
  'www.senat.fr',
  'data.europarl.europa.eu',
  'www.europarl.europa.eu',
  'redmapl3.europarl.europa.eu',
]);
function add(row: ParliamentaryAct) {
  const url = new URL(row.source);
  if (
    url.protocol !== 'https:' ||
    !officialHosts.has(url.host) ||
    url.username ||
    url.password ||
    rows.has(row.id)
  )
    throw new Error(
      'Source institutionnelle ou identifiant invalide : ' + row.id,
    );
  rows.set(row.id, row);
}
const detailedIDs = new Set(register.scrutins.map((b) => b.id));
for (const b of [...register.scrutins, ...complementXVII]) {
  const mentions: Mention[] = [];
  for (const p of b.positions) {
    if (p.vote) mentions.push([p.candidat, p.vote, 'vote']);
    for (const m of p.misesAuPoint) mentions.push([p.candidat, m.vote, 'note']);
  }
  add({
    id: b.id,
    date: b.date,
    institution: 'assemblee',
    nature: 'vote',
    titre: b.objet,
    source: b.source,
    mentions,
    ...(!detailedIDs.has(b.id)
      ? {
          releve: {
            decision: b.decision,
            type: b.type,
            totaux: b.totaux,
            positions: b.positions,
          },
        }
      : {}),
  });
  primarySources.set(b.source, b.id);
}
const attached = new Map<string, string>();
for (const b of archiveBallots) {
  const mentions: Mention[] = [];
  for (const p of b.positions) {
    if (p.vote) mentions.push([p.candidat, p.vote, 'vote']);
    for (const position of p.intentions)
      mentions.push([p.candidat, position, 'note']);
  }
  add({
    id: b.id,
    date: b.date,
    institution: b.institution,
    nature: 'vote',
    titre: b.objet,
    source: b.source,
    mentions,
  });
  primarySources.set(b.source, b.id);
  if (b.scrutinEditorial) attached.set(b.scrutinEditorial, b.id);
}
for (const b of senateRegister.documents) {
  add({
    id: b.id,
    date: b.dateDepot,
    institution: 'senat',
    nature: b.categorie === 'rapport' ? 'rapport' : 'depot',
    titre: b.titre,
    intitule: b.nature,
    source: b.source,
    mentions: b.signatures.map((p) => [p.candidat, p.role, 'signature']),
  });
}
const references = new Map<string, string[]>();
for (const c of voteCases)
  for (const link of c.links) {
    const values = references.get(link.ballotId) ?? [];
    if (!values.includes(c.measure.theme)) values.push(c.measure.theme);
    references.set(link.ballotId, values);
  }
const speakers: Record<string, [string, string]> = {
  'Loïc Prud’homme': ['PA719578', '1184463'],
  'Rémy Rebeyrotte': ['PA722398', '1184575'],
};
for (const b of legislativeVotes.ballots) {
  const source = b.source.url.replace(
    'https://questions.assemblee-nationale.fr/dyn/',
    'https://www.assemblee-nationale.fr/dyn/',
  );
  const linkedID = attached.get(b.id) ?? primarySources.get(source);
  const row = linkedID
    ? rows.get(linkedID)!
    : {
        id: b.id,
        date: b.date,
        institution: b.chamber,
        nature: 'vote',
        titre: b.title,
        source: b.source.url,
        mentions: b.positions.map(
          (p) => [p.candidate, p.choice, 'vote'] as Mention,
        ),
      };
  if (row.date !== b.date || row.institution !== b.chamber)
    throw new Error('Scrutin de référence incompatible : ' + b.id);
  if (
    linkedID &&
    b.positions.some(
      (p) =>
        !row.mentions.some(
          ([c, v, k]) => p.candidate === c && p.choice === v && k === 'vote',
        ),
    )
  )
    throw new Error('Attribution discordante : ' + b.id);
  row.intitule = b.shortTitle;
  row.themes = references.get(b.id)?.sort();
  const link = voteCases.find((c) => c.links.some((l) => l.ballotId === b.id));
  if (link) row.dossier = '/votes/dossiers/' + link.id + '/#scrutin-' + b.id;
  if (!linkedID) add(row);
  for (const speech of b.speeches ?? []) {
    const person = speakers[speech.speaker];
    if (!person || b.id !== 'an15-389')
      throw new Error('Intervention sans repère officiel');
    add({
      id: 'intervention-' + person[0] + '-' + person[1],
      date: b.date,
      institution: b.chamber,
      nature: 'intervention',
      titre: speech.summary,
      intitule: b.shortTitle,
      intervenant: speech.speaker,
      source: speech.url + '#' + person[1],
      mentions: [],
      themes: row.themes,
    });
  }
}
// Stable byte order is the same on every reader, irrespective of locale.
const actes = [...rows.values()].sort((a, b) =>
  a.date === b.date
    ? a.id < b.id
      ? -1
      : a.id > b.id
        ? 1
        : 0
    : a.date > b.date
      ? -1
      : 1,
);
export const searchIndex: ActIndex = {
  version: 1,
  empreinte: createHash('sha256').update(JSON.stringify(actes)).digest('hex'),
  candidats: Object.fromEntries(candidates.map((c) => [c.id, c.name])),
  themes: Object.fromEntries(themes.map((t) => [t.id, t.label])),
  assembleeXVII: {
    scrutinsExamines: register.sources.find((s) => s.legislature === 17)!
      .scrutinsExamines,
    scrutinsAvecMention: actes.filter((b) => b.id.startsWith('VTANR5L17V'))
      .length,
    source: register.sources.find((s) => s.legislature === 17)!.archives
      .scrutins.url,
    personnes: register.personnes,
    mandats: register.mandats,
    groupes: register.groupes,
  },
  seancesEurope: archiveMetadata.sessionsEurope.map((d) => d.date).sort(),
  sessionsSenat: archiveMetadata.sessionsSenat,
  actes,
};
