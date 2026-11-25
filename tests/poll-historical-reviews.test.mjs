import test from 'node:test';
import assert from 'node:assert/strict';
import polls from '../src/data/polls.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };
import catalogue from '../src/data/poll-catalogue.json' with { type: 'json' };
import audits from '../src/data/poll-notice-audits.json' with { type: 'json' };
import specialStudies from '../src/data/poll-special-studies.json' with { type: 'json' };
import { catalogueCoverage } from '../src/lib/poll-catalogue.mjs';
import { renderPollGraphic } from '../src/lib/poll-graphic-view.mjs';
import { documentedSpecialStudies } from '../src/lib/poll-special-studies.mjs';

const imported = [
  ['10193', 11],
  ['10222', 5],
  ['10314', 4],
  ['9944', 2],
  ['9912', 4],
  ['10118', 10],
  ['10195', 8],
  ['10224', 3],
  ['10259', 3],
  ['10318', 3],
  ['10192', 11],
  ['10180', 4],
  ['10165', 2],
  ['9995', 4],
  ['10246', 7],
  ['10166', 12],
  ['10007', 5],
  ['9916', 6],
  ['10277', 7],
  ['10239', 8],
  ['9942', 4],
  ['9913', 2],
  ['10264', 1],
  ['10024', 1],
  ['10035', 4],
  ['9925', 4],
  ['10023', 6],
  ['10167', 3],
  ['10189', 2],
  ['10226', 11],
  ['10325', 5],
  ['9990', 4],
  ['9987', 6],
  ['9930', 13],
];

test('Chaque notice relue couvre des scénarios traçables et rendus dans le Studio', () => {
  const coverage = catalogueCoverage(catalogue, polls, sources, audits);
  for (const [number, count] of imported) {
    const notice = coverage.find((entry) => entry.number === number);
    assert.equal(notice.status, 'integree');
    assert.equal(notice.scenarios.length, count);
    for (const { id, page } of notice.scenarios) {
      const row = polls.find((p) => p.id === id);
      assert.equal(row.historicalImport, true);
      assert.equal(row.question.status, 'verifiee');
      assert.equal(row.question.sourceId, row.noticeSource);
      assert.equal(row.noticePage, page);
      const graphic = renderPollGraphic(row, sources);
      assert.ok(graphic.svg.startsWith('<svg'));
      assert.match(graphic.sources[0].url, new RegExp('#page=' + page + '$'));
    }
  }
});

test('Présitrack reprend les noms et scores du récapitulatif OpinionWay lorsque la notice diverge', () => {
  const september = polls.filter(
    (poll) => poll.surveyId === 'opinionway-commission-10259',
  );
  assert.deepEqual(
    september.map((p) => p.noticePage),
    [13, 14, 15],
  );
  const baseline = september[0];
  assert.equal(
    baseline.resultSource,
    'rapport-opinionway-presitrack-septembre-2026',
  );
  assert.equal(baseline.resultPage, 23);
  assert.equal(baseline.results.find((r) => r.id === 'lepen').percentage, 34);
  assert.equal(baseline.results.find((r) => r.id === 'zemmour').percentage, 4);
  assert.deepEqual(
    baseline.results.find((r) => r.id === 'arthaud'),
    {
      id: 'arthaud',
      name: 'Nathalie Arthaud',
      percentage: null,
      below: 1,
    },
  );
  assert.equal(baseline.usefulSample, null);
});

test('Toluna Harris sépare les rappels, les scénarios chiffrés et leurs questions', () => {
  const may = polls.filter(
    (poll) => poll.surveyId === 'harris-commission-10192',
  );
  const duels = may.filter((poll) => poll.round === 'second');
  assert.equal(duels.length, 6);
  assert.deepEqual(
    duels.map((p) => p.question.page),
    [23, 24, 25, 23, 24, 25],
  );
  assert.deepEqual(
    duels.map((p) => p.noticePage),
    [49, 51, 53, 56, 58, 60],
  );
  assert.ok(may.every((p) => p.usefulSample === null));
  const april = polls.find((poll) => poll.id === 'harris-commission-10180-p28');
  assert.equal(april.results.find((r) => r.id === 'philippe').percentage, 19);
  assert.equal(april.noticePage, 28);
});

test('les archives 2023 et 2024 distinguent cinq terrains, les scénarios et leurs bases', () => {
  const expected = new Map([
    ['ifop-commission-9686', [6, 0]],
    ['harris-commission-9688', [4, 0]],
    ['ifop-commission-9710', [4, 0]],
    ['ifop-commission-9715', [2, 3]],
    ['ifop-commission-9766', [9, 4]],
  ]);
  for (const [id, counts] of expected) {
    const rows = polls.filter((poll) => poll.surveyId === id);
    assert.deepEqual(
      ['premier', 'second'].map(
        (round) => rows.filter((row) => row.round === round).length,
      ),
      counts,
    );
    assert.ok(rows.every((row) => row.registeredSample <= row.sampleSize));
    assert.ok(rows.every((row) => row.question.status === 'verifiee'));
  }
  const april = polls.find((poll) => poll.id === 'harris-commission-9688-p24');
  assert.equal(april.sampleSize, 1320);
  assert.equal(april.registeredSample, 1173);
  assert.equal(april.usefulSample, null);
  assert.equal(april.noIntention, 17);
  const duel = polls.find((poll) => poll.id === 'ifop-commission-9766-p17');
  assert.match(duel.question.base, /795 inscrits.*561 inscrits certains/);
  assert.deepEqual(duel.results.map((row) => row.percentage).sort(), [49, 51]);
  const typo = polls.find((poll) => poll.id === 'ifop-commission-9715-p8');
  assert.equal(typo.round, 'premier');
  assert.equal(typo.question.sourceId, 'ifop-archives-fevrier-2024-rapport');
});

test('Le catalogue distingue les choix de vote des souhaits, de la participation et des primaires', () => {
  const coverage = new Map(
    catalogueCoverage(catalogue, polls, sources, audits).map((notice) => [
      notice.number,
      notice,
    ]),
  );
  for (const [number, whatWasMeasured] of [
    ['10387', /primaire de la droite et du centre/],
    ['10381', /participation envisagée/],
    ['10377', /premier et un deuxième choix/],
    ['10369', /séparément/],
    ['10210', /souhaitent que ce duel ait lieu/],
  ]) {
    const notice = coverage.get(number);
    const publishedSeparately = ['10387', '10381', '10210'].includes(number);
    assert.equal(
      notice.status,
      publishedSeparately ? 'hors_series' : 'non_pertinente',
    );
    assert.deepEqual(notice.scenarios, []);
    assert.match(notice.audit.reason, whatWasMeasured);
    assert.match(notice.audit.reason, /^Pages? \d/);
  }
  for (const number of ['10141', '10292'])
    assert.notEqual(coverage.get(number).status, 'non_pertinente');
});

test('Cluster17 conserve les deux configurations et les cinq duels sur les effectifs pondérés du terrain', () => {
  const wave = polls.filter(
    (poll) => poll.surveyId === 'cluster17-commission-10246',
  );
  assert.deepEqual(
    wave.map((p) => p.noticePage),
    [18, 19, 20, 20, 21, 21, 22],
  );
  assert.deepEqual(
    wave.map((p) => p.usefulSample),
    [1032, 1052, 997, 1001, 968, 939, 771],
  );
  assert.deepEqual(
    wave[2].results.map((result) => result.percentage),
    [39.2, 60.8],
  );
  assert.equal(wave[2].noIntention, null);
  assert.equal(wave[2].margin.confidence, null);
  assert.match(wave[2].uncertainty, /1[\s\u202f]041 intentions exprimées/);
  assert.equal(wave[2].fieldworkEnd, '2026-07-24');
  assert.equal(wave[2].published, '2026-08-31');
});

test('Les vagues Elabe conservent les bases, les pages du rapport et les divergences de documentation', () => {
  const march = polls.filter(
    (poll) => poll.surveyId === 'elabe-commission-10166',
  );
  assert.equal(march.length, 12);
  assert.ok(march.every((p) => p.usefulSample === null));
  assert.ok(march.every((p) => p.question.base.includes('8 à 10')));
  assert.equal(march[0].resultSource, 'elabe-rapport-10166');
  assert.equal(march[0].resultPage, 11);
  assert.equal(march[0].noIntention, 15);
  assert.match(march[0].noIntentionNote, /Vote blanc ou nul et abstention/);
  assert.match(march[0].uncertainty, /rapport indique le téléphone/);
  const april = polls.find((poll) => poll.surveyId === 'elabe-commission-9916');
  assert.match(
    april.uncertainty,
    /page 5 de la notice mentionne les législatives/,
  );
});

test('Deux publications de Verian utilisent un seul terrain et cinq configurations uniques', () => {
  const wave = polls.filter(
    (p) => p.surveyId === 'verian-lhemicycle-2025-11-20',
  );
  assert.equal(wave.length, 5);
  assert.equal(
    wave.filter(
      (p) => p.scenario === 'Premier tour · Configuration de référence',
    ).length,
    1,
  );
  assert.deepEqual(
    wave.map((p) => p.usefulSample),
    [696, 696, 681, 690, 696],
  );
  assert.deepEqual(
    wave.map((p) => p.resultPage),
    [3, 6, 9, 12, 15],
  );
  assert.equal(wave[0].published, '2025-11-27');
  assert.equal(wave[1].published, '2025-12-12');
  assert.deepEqual(wave[2].margin, { min: 1.7, max: 3.9, confidence: 95 });
});

test('Deux vagues Harris préservent les bases exprimées et le sens des résultats publiés', () => {
  const august = polls.filter((p) => p.surveyId === 'harris-commission-10239');
  const september = polls.filter(
    (p) => p.surveyId === 'harris-commission-10277',
  );
  assert.equal(august.length, 8);
  assert.ok(august.every((p) => p.usefulSample === null));
  assert.deepEqual(
    september.map((p) => p.usefulSample),
    [1242, 1227, 1216, 1219, 1223, 1055, 1125],
  );
  assert.ok(september.every((p) => p.question.base.includes('certains')));
  assert.equal(september.filter((p) => p.round === 'second').length, 2);
});

test('L’enquête OpinionWay indique son commanditaire et conserve le score sous le seuil', () => {
  const poll = polls.find((p) => p.surveyId === 'opinionway-commission-10264');
  assert.equal(poll.commissioner, 'Sébastien Bonnal');
  assert.match(poll.uncertainty, /date de première diffusion restent inconnus/);
  const result = poll.results.find((p) => p.name === 'Sébastien Bonnal');
  assert.equal(result.percentage, null);
  assert.equal(result.below, 1);
});

test('Odoxa et Elabe conservent le lien entre les questions, les scores et leurs bases de calcul', () => {
  const november = polls.filter(
    (poll) => poll.surveyId === 'odoxa-commission-10023',
  );
  assert.deepEqual(
    november.map((poll) => poll.usefulSample),
    [874, 864, 803, 795, 689, 776],
  );
  assert.deepEqual(
    november.map((poll) => [poll.question.page, poll.resultPage]),
    [
      [2, 24],
      [2, 26],
      [3, 29],
      [4, 30],
      [4, 31],
      [3, 32],
    ],
  );
  assert.deepEqual(
    november[3].results.map((result) => [result.name, result.percentage]),
    [
      ['Raphaël Glucksmann', 42],
      ['Jordan Bardella', 58],
    ],
  );
  const july = polls.filter(
    (poll) => poll.surveyId === 'elabe-commission-10226',
  );
  assert.equal(july.filter((poll) => poll.round === 'premier').length, 6);
  assert.equal(july.filter((poll) => poll.round === 'second').length, 5);
  assert.ok(
    july.every(
      (poll) =>
        poll.usefulSample === null && poll.question.base.includes('8 à 10'),
    ),
  );
  assert.deepEqual(
    july[6].results.map((result) => result.percentage),
    [32.5, 67.5],
  );
  assert.equal(july[6].noIntention, 29);
  assert.equal(july[6].noticePage, 9);
  assert.equal(july[6].resultPage, 22);
});

test('Cluster17 garde les scores publiés et laisse indéterminé un effectif pondéré ambigu', () => {
  const october = polls.filter(
    (p) => p.surveyId === 'cluster17-commission-10325',
  );
  assert.deepEqual(
    october.map((p) => p.usefulSample),
    [852, 828, 821, 813, 821],
  );
  assert.deepEqual(
    october.map((p) => p.resultPage),
    [5, 11, 17, 23, 29],
  );
  assert.equal(
    october[0].results.find((r) => r.id === 'melenchon').percentage,
    18,
  );
  const previous = polls.filter(
    (p) => p.surveyId === 'cluster17-commission-9990',
  );
  assert.deepEqual(
    previous.map((p) => p.usefulSample),
    [924, 907, 911, null],
  );
  assert.match(
    previous[3].uncertainty,
    /deux effectifs pondérés au scénario 3/,
  );
  assert.equal(previous[3].noIntention, null);
});

test('Ifop distingue les deux périodes et les bases exprimées des tableaux disponibles', () => {
  const first = polls.filter(
    (p) => p.surveyId === 'ifop-commission-9930-terrain-1',
  );
  const second = polls.filter(
    (p) => p.surveyId === 'ifop-commission-9930-terrain-2',
  );
  assert.equal(first.length, 10);
  assert.ok(
    first.every(
      (p) => p.sampleSize === 10000 && p.fieldworkEnd === '2025-04-18',
    ),
  );
  assert.deepEqual(
    first.map((p) => p.usefulSample),
    [5454, 5537, 5525, 5459, 5492, 5415, 5059, 4420, 4952, 4090],
  );
  assert.deepEqual(
    second.map((p) => p.usefulSample),
    [1078, 1069, 1001],
  );
  assert.ok(
    second.every(
      (p) => p.registeredSample === 1838 && p.fieldworkStart === '2025-04-29',
    ),
  );
  assert.equal(second[1].noticePage, 27);
  assert.equal(second[1].resultPage, undefined);
  assert.match(second[2].uncertainty, /premier tour/);
  const september = polls.filter((p) => p.surveyId === 'ifop-commission-9987');
  assert.ok(september.every((p) => p.usefulSample === null));
  assert.deepEqual(
    september.map((p) => p.noIntention),
    [29.7, 29.1, 30.3, 31.5, 32, 32.4],
  );
});

test('Les souhaits, la participation et la primaire gardent leurs propres bases et leurs pièces', () => {
  const catalogueRows = catalogueCoverage(catalogue, polls, sources, audits);
  const studies = new Map(
    documentedSpecialStudies(specialStudies, catalogueRows).map((study) => [
      study.number,
      study,
    ]),
  );
  const cluster = studies.get('10228');
  assert.equal(cluster.category, 'opinion');
  assert.deepEqual(
    cluster.tables.map((table) => [table.questionPage, table.page]),
    [
      [8, 19],
      [8, 20],
    ],
  );
  assert.equal(
    cluster.tables[1].results.find((result) => result.label === 'Marine Le Pen')
      .percentage,
    29.6,
  );
  assert.equal(
    catalogueRows.find((row) => row.number === '10228').scenarios.length,
    0,
  );
  const participation = studies.get('10381');
  assert.deepEqual(
    participation.tables[1].results.map((result) => result.percentage),
    [62, 64, 65],
  );
  assert.match(participation.tables[2].base, /abstentionnistes/);
  const primary = studies.get('10387');
  assert.match(primary.tables[0].base, /542 personnes/);
  assert.match(primary.tables[1].base, /996 inscrits/);
  assert.equal(studies.get('10210').tables[0].results[0].percentage, 45.3);
});

test('OpinionWay conserve les réponses par nom et les préférences en duel de la même notice', () => {
  const studies = documentedSpecialStudies(
    specialStudies,
    catalogueCoverage(catalogue, polls, sources, audits),
  );
  const opinionway = studies.find((study) => study.number === '10218');
  assert.equal(
    opinionway.tables.filter((table) => table.questionPage === 7).length,
    13,
  );
  const possible = opinionway.tables.filter(
    (table) => table.questionPage === 6,
  );
  assert.deepEqual(
    possible.map((table) => table.page),
    [17, 18, 19, 20],
  );
  assert.deepEqual(
    possible.flatMap((table) => table.results.map((row) => row.percentage)),
    [9, 9, 17, 16, 25, 27, 20, 25, 26, 11],
  );
});

test('Les archives et le scénario complémentaire de l’Ifop gardent leur source et la précision publiée', () => {
  const harris = polls.filter((p) => p.surveyId === 'harris-2023-09-01');
  assert.equal(harris.length, 8);
  assert.ok(
    harris.every(
      (p) =>
        p.noticeRole === 'rapport' &&
        p.registeredSample === 2148 &&
        p.question.status === 'a-relire' &&
        p.usefulSample === null,
    ),
  );
  const cluster = polls.filter(
    (p) => p.surveyId === 'cluster17-commission-9753',
  );
  assert.deepEqual(
    cluster.map((p) => [p.round, p.usefulSample, p.noticePage]),
    [
      ['premier', 1238, 18],
      ['premier', 1182, 22],
      ['second', 1063, 26],
      ['second', 920, 30],
    ],
  );
  const opinionway = polls.find(
    (p) => p.surveyId === 'opinionway-commission-9689',
  );
  assert.equal(opinionway.published, null);
  assert.equal(opinionway.fieldworkEnd, '2023-04-13');
  assert.equal(
    opinionway.results.find((r) => r.id === 'bardella').percentage,
    23,
  );
  const supplement = polls.find((p) => p.id === 'ifop-2026-11-18-rapport-p10');
  assert.equal(supplement.resultPage, 10);
  assert.equal(supplement.noticeRole, 'methodologie');
  assert.equal(supplement.usefulSample, null);
  assert.equal(supplement.results.find((r) => r.id === 'lepen').percentage, 36);
  assert.equal(
    catalogueCoverage(catalogue, polls, sources, audits).find(
      (row) => row.number === '10384',
    ).scenarios.length,
    5,
  );
});

test('Une réponse de potentiel électoral garde la base des inscrits et ne devient pas une intention de vote', () => {
  const coverage = catalogueCoverage(catalogue, polls, sources, audits);
  const studies = documentedSpecialStudies(specialStudies, coverage);
  const potential = studies.find((study) => study.number === '10363');
  assert.equal(potential.tables.flatMap((table) => table.results).length, 46);
  assert.match(potential.tables[0].base, /989 inscrits/);
  assert.equal(coverage.find((r) => r.number === '10363').scenarios.length, 0);
});
