import { attributionLabel, unspecifiedCollective } from './attribution.mjs';
import { identicalProposals } from './corpus-counts.mjs';
import { normalize } from './features.mjs';

const commonWords = new Set(
  'alors ainsi afin avec dans des dont elle elles encore entre est etre leur leurs lors mais meme mes moins nos notre ont par pas pour selon ses son sont sous sur tout toute tous toutes tres une vers vos votre plus sans jamais aucun aucune aucuns aucunes'.split(
    ' ',
  ),
);
const titles = { words: 3, overlap: 0.8 };
const descriptions = { words: 6, overlap: 0.84 };
const compact = (value) =>
  value?.normalize('NFC').trim().replace(/\s+/gu, ' ') ?? null;
const compareId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function terms(text) {
  return new Set(
    (normalize(text).match(/\p{L}{3,}/gu) ?? []).filter(
      (term) => !commonWords.has(term),
    ),
  );
}

function close(left, right, { words, overlap }) {
  if (Math.min(left.size, right.size) < words) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared >= words && (2 * shared) / (left.size + right.size) >= overlap;
}

function numericText(row) {
  return [row.title, row.description].map(
    (text) =>
      compact(text).match(
        /(?<![\p{L}\p{N}])[+−-]?\d+(?: \d{3})*(?:[.,]\d+)?(?:\s*(?:[%€$]|euros?\b|ans?\b|années?\b|annuités?\b|jours?\b|heures?\b|mois\b|points?\b|millions?\b|milliards?\b))?/gu,
      ) ?? [],
  );
}

function negation(text) {
  return (
    normalize(text).match(
      /\b(?:ne|pas|ni|sans|non|jamais|nullement|gu[eè]re|aucun(?:e|es|s)?)\b|\bn['’]/gu,
    ) ?? []
  ).map((marker) => marker.replace('’', "'"));
}

const signature = (rows, keys) =>
  rows.map((row) => JSON.stringify(keys.map((key) => row[key]))).sort();

function signals(record) {
  return {
    nombre: JSON.stringify([
      record.reperesChiffres,
      signature(record.indicateurs, ['key', 'value', 'unit']),
      signature(record.montants, ['label', 'value', 'unit', 'period', 'basis']),
    ]),
    portee: JSON.stringify([
      record.type,
      compact(record.echeance),
      compact(record.financement),
    ]),
    auteur: compact(record.auteur),
    dossier: record.dossier,
    beneficiaires: compact(record.beneficiaires),
    negation: JSON.stringify(record.marqueursNegation),
  };
}

/** Relecture de vocabulaire dans chaque thème, sur l’état courant des fiches. */
export function proposalWording({ measures, candidates, sources, versions }) {
  const knownCandidates = new Map(candidates.map((row) => [row.id, row.name]));
  const knownSources = new Map(sources.map((row) => [row.id, row]));
  const knownVersions = new Map(
    versions.map((row) => [row.measureId + ':' + row.number, row.id]),
  );
  const identical = identicalProposals(measures);
  const exactGroup = new Map(
    identical.flatMap((ids) => ids.map((id) => [id, ids[0]])),
  );
  const current = measures
    .filter((row) => row.scope !== 'archive')
    .sort((a, b) => compareId(a.id, b.id));
  const byTheme = new Map();
  for (const row of current) {
    const candidate = knownCandidates.get(row.candidate);
    const version = knownVersions.get(row.id + ':' + row.revision);
    if (!candidate || !version)
      throw Error('Dossier ou version introuvable pour ' + row.id);
    const record = {
      id: row.id,
      version,
      dossier: row.candidate,
      auteur: attributionLabel(row, candidate),
      type: row.scope,
      edition: row.edition,
      verifieLe: row.checked,
      titre: row.title,
      description: row.description,
      beneficiaires: row.beneficiaries,
      echeance: row.timing,
      financement: row.financing,
      indicateurs: row.metrics,
      montants: row.amounts,
      reperesChiffres: numericText(row),
      marqueursNegation: [negation(row.title), negation(row.description)],
      sources: row.sourceRefs.map((ref) => {
        const source = knownSources.get(ref.sourceId);
        if (!source) throw Error('Source introuvable : ' + ref.sourceId);
        return {
          id: source.id,
          titre: source.title,
          url: ref.fragment
            ? source.url.split('#')[0] + '#' + ref.fragment
            : source.url,
          passage: ref.locator,
        };
      }),
    };
    const entries = byTheme.get(row.theme) ?? [];
    entries.push({
      record,
      title: terms(row.title),
      description: terms(row.description),
      signals: signals(record),
    });
    byTheme.set(row.theme, entries);
  }

  const pairs = [];
  const records = new Map();
  for (const theme of [...byTheme.keys()].sort()) {
    const rows = byTheme.get(theme);
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        const key = exactGroup.get(a.record.id);
        if (key && key === exactGroup.get(b.record.id)) continue;
        const common = [];
        if (close(a.title, b.title, titles)) common.push('titre');
        if (close(a.description, b.description, descriptions))
          common.push('description');
        if (!common.length) continue;
        const differences = Object.keys(a.signals).filter(
          (key) => a.signals[key] !== b.signals[key],
        );
        pairs.push({
          theme,
          fiches: [a.record.id, b.record.id],
          rapprochement: common,
          ecarts: differences,
          auteurIndetermine:
            a.record.auteur === unspecifiedCollective ||
            b.record.auteur === unspecifiedCollective,
        });
        records.set(a.record.id, a.record);
        records.set(b.record.id, b.record);
      }
    }
  }
  return {
    fichesCourantesExaminees: current.length,
    groupesIdentiques: identical.length,
    paires: pairs,
    fiches: [...records.values()].sort((a, b) => compareId(a.id, b.id)),
  };
}
