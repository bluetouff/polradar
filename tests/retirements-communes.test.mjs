import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  readCommuneIndex,
  readCommune,
  readBallot,
  describeBallot,
  communeCode,
  parseCommuneLink,
  searchCommunes,
  searchKey,
  vacancyLabel,
} from '../src/lib/communes.mjs';
import {
  retirementComparison,
  retirementUrl,
} from '../src/lib/retirement-comparison.mjs';
import { retirementSvg } from '../src/lib/retirement-svg.mjs';

const json = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const dataset = Object.fromEntries(
  ['candidates', 'versions', 'measures', 'sources'].map((name) => [
    name,
    json(`../src/data/${name}.json`),
  ]),
);
const retirement = json('../src/data/retirement-comparison.json');
const cohorts = new Map(
  retirement.cohorts.map((cohort) => [cohort.id, cohort]),
);
const elections = json('../src/data/communes-2022.json');
const dir = '../public/data/communes/2022/';
const sizes = elections.rounds.map(({ candidates }) => candidates.length);
const getRecord = (code) =>
  json(`${dir}${code.slice(0, 2)}.json`).find((row) => row[0] === code);

test('les bornes par génération correspondent aux articles L. 161-17-2 et L. 161-17-3', () => {
  assert.equal(retirement.effectiveFrom, '2026-09-01');
  assert.equal(retirement.automaticAgeMonths, 67 * 12);
  assert.deepEqual(
    [...cohorts.values()].map(({ ageMonths, quarters }) => [
      ageMonths,
      quarters,
    ]),
    [
      [62 * 12 + 3, 169],
      [62 * 12 + 6, 169],
      [62 * 12 + 9, 170],
      [63 * 12, 171],
      [63 * 12 + 3, 172],
      [63 * 12 + 6, 172],
      [63 * 12 + 9, 172],
      [64 * 12, 172],
    ],
  );
  assert.equal(new Set([...cohorts.keys()].map(retirementUrl)).size, 8);
});

test('les trois versions officielles distinguent durée de cotisation, âge cible et âge sans décote', () => {
  const { panels, programmes } = retirementComparison(
    retirement,
    cohorts.get('1969-et-apres'),
    dataset,
  );
  assert.deepEqual(
    panels.map(({ rows }) => rows.map(({ text }) => text)),
    [
      ['64 ans', '60 ans', '65 ans', '63 ans'],
      ['172 trimestres', '40 annuités', '45 annuités', 'Non précisé'],
      ['67 ans', 'Non précisé', 'Non précisé', '65 ans'],
    ],
  );
  assert.deepEqual(
    panels[1].rows.map(({ position }) => position),
    [0.6, 0, 1, null],
  );
  assert.deepEqual(
    programmes.map(({ versionLink }) => versionLink),
    [
      '/mesures/melenchon-retraites-1/#version-2',
      '/mesures/philippe-retraites-1/#version-3',
      '/mesures/retailleau-retraites-1/#version-2',
    ],
  );
  const draft = structuredClone(retirement);
  draft.programmes[1].versionId = 'philippe-retraites-2-v3';
  assert.throws(
    () => retirementComparison(draft, cohorts.get('1969-et-apres'), dataset),
    /Métrique absente/,
  );
});

test('chaque SVG affiche les mêmes valeurs et échappe le texte', () => {
  for (const cohort of cohorts.values()) {
    const { panels, programmes } = retirementComparison(
      retirement,
      cohort,
      dataset,
    );
    const svg = retirementSvg(
      cohort,
      panels,
      programmes,
      `https://polradar.fr${retirementUrl(cohort.id)}`,
      retirement.reviewedOn,
    );
    assert.match(svg, /viewBox="0 0 1280 785"/);
    assert.match(svg, /<desc id="desc">/);
    for (const panel of panels)
      for (const row of panel.rows) assert.ok(svg.includes(row.text));
    assert.doesNotMatch(
      svg,
      /<(script|style|foreignObject|image)\b|\son[a-z]+=/i,
    );
  }
  const { panels, programmes } = retirementComparison(
    retirement,
    cohorts.get('1962'),
    dataset,
  );
  panels[0].rows[0].name = 'Nord & Sud <Ouest>';
  assert.match(
    retirementSvg(
      cohorts.get('1962'),
      panels,
      programmes,
      '/',
      retirement.reviewedOn,
    ),
    /Nord &amp; Sud &lt;Ouest&gt;/,
  );
});

test('les fichiers publics se réconcilient avec les deux totaux nationaux du ministère', () => {
  const index = new Map(readCommuneIndex(json(`${dir}index.json`)));
  const covered = new Set();
  let withContext = 0;
  const totals = elections.rounds.map(({ national, excluded }, round) => {
    readBallot(national, sizes[round]);
    return [...readBallot(excluded, sizes[round])];
  });
  for (const file of readdirSync(new URL(dir, import.meta.url))) {
    if (file === 'index.json') continue;
    assert.match(file, /^(?:\d\d|2[AB])\.json$/);
    for (const input of json(`${dir}${file}`)) {
      const [code, first, final, context] = readCommune(input, input[0], sizes);
      assert.ok(
        index.has(code) &&
          file.startsWith(code.slice(0, 2)) &&
          !covered.has(code),
      );
      covered.add(code);
      if (context !== null) withContext++;
      [first, final].forEach((counts, round) =>
        counts.forEach((value, column) => {
          totals[round][column] += value;
        }),
      );
    }
  }
  assert.equal(elections.count, 35034);
  assert.equal(covered.size, elections.count);
  assert.equal(index.size, covered.size);
  assert.equal(withContext, elections.withContext);
  assert.deepEqual(
    totals,
    elections.rounds.map(({ national }) => national),
  );
  assert.deepEqual(elections.preview.record, getRecord('75056'));
  assert.equal(elections.preview.name, index.get('75056'));
});

test('les résultats distinguent voix, participation, regroupements et absences de suffrages', () => {
  const [_, first, final, context] = getRecord('28085');
  const tour1 = describeBallot(first, elections.rounds[0].candidates);
  const tour2 = describeBallot(final, elections.rounds[1].candidates);
  // Archives du ministère, commune de Chartres, et comparateur de l'Insee.
  assert.deepEqual(
    [tour1.voters, tour1.expressed, tour2.voters, tour2.expressed],
    [17745, 17428, 17374, 15887],
  );
  assert.deepEqual(
    tour2.candidates.map(({ count }) => count),
    [10617, 5270],
  );
  assert.equal(context[0], 38324);
  assert.match(vacancyLabel(context[2], context[1]), /^10,9\s%$/);
  assert.equal(getRecord('01187')[3], null);
  assert.equal(getRecord('97616')[3], null);
  assert.equal(getRecord('97801')[3], null);
  const noVotes = describeBallot(
    getRecord('02078')[1],
    elections.rounds[0].candidates,
  );
  assert.equal(noVotes.expressed, 0);
  assert.equal(noVotes.invalid, 93);
  assert.ok(
    noVotes.candidates.every(
      ({ score, width }) => score === 'Indisponible' && width === 0,
    ),
  );
  assert.throws(() => readBallot([5, 6, 0, 0, 6], 1), /incohérents/);
  assert.throws(() => readBallot([7, 6, 0, 0, 5], 1), /incohérents/);
  assert.throws(
    () => readCommune(getRecord('28085'), '75056', sizes),
    /inattendu/,
  );
});

test('la recherche préserve les codes de Corse, les zéros initiaux et les homonymes', () => {
  const index = readCommuneIndex(json(`${dir}index.json`)).map(
    ([code, name]) => ({ code, name, key: searchKey(name) }),
  );
  assert.equal(
    searchCommunes(index, searchKey('pointe a pitre'))[0].code,
    '97120',
  );
  assert.equal(searchCommunes(index, searchKey('01001'))[0].code, '01001');
  assert.equal(searchCommunes(index, searchKey('2a065'))[0].code, '2A065');
  assert.ok(
    searchCommunes(index, searchKey('Saint-Sauveur')).filter(
      ({ name }) => name === 'Saint-Sauveur',
    ).length > 1,
  );
  for (const hash of [
    '#commune=../../75',
    '#commune=28085&x=1',
    '#commune=2a065',
    '#commune=28085%2F',
    '#commune=https://polradar.fr/',
  ]) {
    assert.equal(parseCommuneLink(hash), null);
  }
  assert.equal(parseCommuneLink('#commune=2A065'), '2A065');
  assert.equal(communeCode.test('028085'), false);
});
