import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  airtimeSchema,
  compileArcom,
  durationSeconds,
  readArcomCsv,
} from '../src/lib/airtime.mjs';
import { airtimeView, formatDuration } from '../src/lib/airtime-view.mjs';
import {
  programmeBudgetSchema,
  agendaSchema,
  mapSchema,
  validateVisualReferences,
} from '../src/lib/campaign-visuals.mjs';
import {
  agendaStatusLabel,
  agendaMatches,
  agendaWeeks,
  parisToday,
  weekStart,
  projectFrance,
  clusterCities,
  formatMoney,
  formatBudgetAmount,
  budgetAnnualScales,
  budgetAllocationTotal,
} from '../src/lib/campaign-visuals-view.mjs';
const data = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const airtime = data('airtime'),
  budgets = data('programme-budgets'),
  agenda = data('campaign-agenda'),
  map = data('france-map');
test('un passage dont le jour est inconnu conserve ses bornes dans les filtres de l’agenda', () => {
  const event = {
    ...agenda.events[0],
    date: '2026-10-09',
    latestPossibleDate: '2026-10-13',
    time: null,
    status: 'tenu',
  };
  const sample = { ...agenda, events: [event] };
  assert.equal(agendaSchema.safeParse(sample).success, true);
  for (const patch of [
    { time: '09:00' },
    { latestPossibleDate: event.date },
    { latestPossibleDate: '2026-10-08' },
  ]) {
    assert.equal(
      agendaSchema.safeParse({ ...sample, events: [{ ...event, ...patch }] })
        .success,
      false,
    );
  }
  assert.deepEqual(agendaWeeks(event), ['2026-10-05', '2026-10-12']);
  assert.equal(
    agendaMatches(event, { week: '2026-10-12', period: 'tous' }, '2026-11-20'),
    true,
  );
  assert.equal(
    agendaMatches(event, { week: '2026-10-19', period: 'tous' }, '2026-11-20'),
    false,
  );
  assert.equal(agendaMatches(event, { period: 'passes' }, '2026-10-11'), false);
});
const csv =
  ";Appartenance;TF1;TF1;TF1\nType de service;-;Chaîne généraliste;Chaîne généraliste;Chaîne généraliste\nType d'émission;-;JTF;MAG;PROG\nARTHAUD Nathalie;Lutte Ouvrière;00:01:30;-;00:00:30\nBRANCO REMI;Autre;00:05:00;-;-\n";
test('les quatre jeux de données et leurs références sont qualifiés', () => {
  airtimeSchema.parse(airtime);
  programmeBudgetSchema.parse(budgets);
  agendaSchema.parse(agenda);
  mapSchema.parse(map);
  assert.deepEqual(
    validateVisualReferences(
      budgets,
      agenda,
      data('candidates'),
      data('sources'),
      data('versions'),
    ),
    [],
  );
});

test('les petits montants et les fourchettes gardent leur précision et leur unité', () => {
  assert.equal(formatMoney(240e6), '240 M€');
  assert.equal(formatMoney(1.025e9), '1,025 Md€');
  assert.equal(
    formatBudgetAmount({ euros: 8e9, eurosMax: 12e9, approximate: false }),
    '8 à 12 Md€',
  );
  assert.equal(
    formatBudgetAmount({ euros: 18.5e9, approximate: true }),
    '≈ 18,5 Md€',
  );
  for (const maximum of [3e9, 2e9, Infinity, NaN]) {
    const copy = structuredClone(budgets);
    const range = copy.profiles
      .find((p) => p.candidate === 'branco')
      .entries.find((e) => e.eurosMax !== undefined);
    range.eurosMax = maximum;
    assert.equal(programmeBudgetSchema.safeParse(copy).success, false);
  }
  const copy = structuredClone(budgets),
    row = copy.profiles.find((p) => p.candidate === 'lisnard').entries[0];
  row.eurosMax = row.euros + 1;
  assert.equal(programmeBudgetSchema.safeParse(copy).success, false);
});
test('un écart publié reste explicite, signé et contrôlé sans poste de compensation', () => {
  const rows = budgets.profiles.flatMap((p) => p.entries);
  for (const [id, sum, difference] of [
    ['melenchon-investissement-btp', 12.01e9, 10e6],
    ['melenchon-investissement-auto', 1.37e9, -30e6],
    ['mikolajczak-canicules', 9.45e9, -50e6],
  ]) {
    const entry = rows.find((e) => e.id === id);
    assert.equal(budgetAllocationTotal(entry), sum);
    assert.equal(entry.allocationDifference.euros, difference);
    for (const mutate of [
      (e) => delete e.allocationDifference,
      (e) => (e.allocationDifference.euros *= -1),
      (e) => (e.allocationDifference.note = ''),
      (e) => (e.allocation = []),
      (e) => (e.allocationUnit = 'pourcentage'),
      (e) => (e.approximate = true),
      (e) => (e.allocation[0].value += 1e6),
    ]) {
      const copy = structuredClone(budgets);
      mutate(copy.profiles.flatMap((p) => p.entries).find((e) => e.id === id));
      assert.equal(programmeBudgetSchema.safeParse(copy).success, false);
    }
  }
  const textile = rows.find((e) => e.id === 'melenchon-investissement-textile');
  assert.equal(textile.allocation.length, 6); // Top-level axes; “dont” is not counted twice.
  assert.equal(budgetAllocationTotal(textile), 240e6);
  const copy = structuredClone(budgets);
  copy.profiles.find(
    (p) => p.candidate === 'lisnard',
  ).entries[0].allocationDifference = { euros: 1, note: 'Écart' };
  assert.equal(programmeBudgetSchema.safeParse(copy).success, false);
});

test('les échelles annuelles séparent dépenses et recettes, sans inclure les enveloppes sur cinq ans', () => {
  const scales = budgetAnnualScales([
    {
      entries: [
        { period: 'annuel', kind: 'depense', euros: 1e9, allocation: [] },
        {
          period: 'annuel',
          kind: 'depense',
          euros: 3e9,
          eurosMax: 4e9,
          allocation: [],
        },
        {
          period: 'pluriannuel',
          kind: 'depense',
          euros: 500e9,
          allocation: [],
        },
        { period: 'annuel', kind: 'economie', euros: 200e9, allocation: [{}] },
        { period: 'annuel', kind: 'economie', euros: 5e9, allocation: [] },
        { period: 'annuel', kind: 'recette', euros: 20e9, allocation: [] },
        { period: 'non-precise', kind: 'recette', euros: 60e9, allocation: [] },
      ],
    },
  ]);
  assert.equal(scales.depense, 4e9);
  assert.equal(scales.economie, 5e9);
  assert.equal(scales.recette, 20e9);
});

test('les nouveaux chiffrages conservent la période et le périmètre de leurs documents', () => {
  const rows = budgets.profiles.flatMap((p) => p.entries);
  const entry = (id) => rows.find((e) => e.id === id);
  assert.equal(entry('asselineau-regions').period, 'non-precise');
  assert.equal(entry('tondelier-violences').period, 'non-precise');
  assert.equal(entry('attal-economies-quinquennat').period, 'pluriannuel');
  assert.equal(entry('roussel-pacte-investissement').kind, 'financement');
  assert.deepEqual(
    [
      entry('ruffin-logements-jeunes').euros,
      entry('ruffin-logements-jeunes').eurosMax,
    ],
    [8e9, 12e9],
  );
  assert.equal(entry('melenchon-investissement-textile').euros, 240e6);
  assert.equal(
    entry('philippot-recettes').allocation.reduce((sum, p) => sum + p.value, 0),
    74.8e9,
  );
  const copy = structuredClone(budgets),
    lisnard = copy.profiles.find((p) => p.candidate === 'lisnard').entries[0];
  lisnard.additionalSources.push('inconnue');
  assert.ok(
    validateVisualReferences(
      copy,
      agenda,
      data('candidates'),
      data('sources'),
      data('versions'),
    ).length,
  );
});

test('les rendez-vous conservent les communes réelles et les horaires inconnus', () => {
  const event = (id) => agenda.events.find((e) => e.id === id);
  assert.equal(event('lisnard-chassieu-1213').city, 'chassieu');
  assert.equal(event('miko-ivry-1118').city, 'ivry-sur-seine');
  assert.equal(event('philippe-programme-1118').city, null);
  assert.equal(event('philippe-programme-1118').time, null);
  assert.equal(event('tondelier-arcueil-0917').time, null);
  assert.equal(event('ruffin-lyon-0425').time, '16:00');
});
test('le lecteur CSV refuse un grain modifié et préserve les valeurs absentes', () => {
  const [service] = compileArcom(csv);
  assert.equal(service.totalSeconds, 420);
  assert.deepEqual(
    service.observations.find((o) => o.candidate === 'arthaud'),
    { candidate: 'arthaud', seconds: 120, publishedCells: 2 },
  );
  assert.equal(
    service.observations.find((o) => o.candidate === 'philippe').seconds,
    null,
  );
  assert.equal(
    service.observations.some((o) => o.candidate === 'branco'),
    false,
  );
  assert.throws(() => compileArcom(csv.replace('MAG;PROG', 'MAG;TOTAL')));
  assert.throws(() => compileArcom(csv.replace('00:01:30', '00:90:30')));
  assert.throws(() =>
    compileArcom(csv + 'ARTHAUD Nathalie;Autre;00:02:00;-;-\n'),
  );
  assert.throws(() =>
    compileArcom(csv.replace('TF1;TF1;TF1', 'TF1;TF1;France 2')),
  );
  assert.throws(() => readArcomCsv('"incomplet'));
  assert.deepEqual(readArcomCsv('"a;b";"c""d"\n'), [['a;b', 'c"d']]);
  assert.equal(durationSeconds('-'), null);
  assert.equal(durationSeconds('00:00:00'), 0);
  for (const value of ['', '0', '-1:00:00', '00:00:60'])
    assert.throws(() => durationSeconds(value));
});
test('la bande utilise toutes les durées publiées du média comme dénominateur', () => {
  const snapshot = {
    months: [{ month: '2026-09', services: compileArcom(csv) }],
  };
  const v = airtimeView(snapshot, '2026-09', 'television', 'arthaud').rows[0];
  assert.equal(v.segments[0].width, (120 / 420) * 100);
  assert.equal(v.others, 300);
  assert.ok(Math.abs(v.segments[0].width + v.othersWidth - 100) < 1e-10);
  assert.equal(
    airtimeView(snapshot, '2026-09', 'television', 'branco').rows[0].segments[0]
      .seconds,
    null,
  );
  assert.equal(formatDuration(null), 'Non publié');
  assert.equal(formatDuration(0), '0 s');
  assert.equal(formatDuration(3661), '1 h 1 min 1 s');
});
test('le contrôle indépendant du relevé de septembre conserve les secondes Arcom', () => {
  const row = airtime.months
    .find((m) => m.month === '2026-09')
    .services.find((s) => s.name === 'BFMTV');
  // CSV source: JTF 03:37:36, MAG 01:19:02, PROG « - ».
  assert.equal(
    row.observations.find((o) => o.candidate === 'retailleau').seconds,
    17798,
  );
  assert.equal(row.totalSeconds, 639161);
  const radio = airtimeView(airtime, '2026-09', 'radio');
  assert.equal(radio.rows.length, 9);
  assert.ok(radio.rows.every((s) => s.kind === 'radio'));
});
test('inconnus, sommes impossibles et mois incomplets bloquent les relevés', () => {
  for (const mutate of [
    (d) => d.months.push(d.months[0]),
    (d) => (d.months[0].month = '2026-11'),
    (d) => (d.months[0].services[0].totalSeconds = 1),
    (d) => (d.months[0].services[0].observations[0].seconds = -1),
    (d) => (d.months[0].sourceUrl = 'https://example.org/file.csv'),
  ]) {
    const copy = structuredClone(airtime);
    mutate(copy);
    assert.equal(airtimeSchema.safeParse(copy).success, false);
  }
  const copy = structuredClone(airtime),
    o = copy.months[0].services[0].observations.find((o) => o.seconds === null);
  o.seconds = 0;
  assert.equal(airtimeSchema.safeParse(copy).success, false);
});
test('les budgets réconcilient chaque répartition et conservent les périodes', () => {
  const retail = budgets.profiles.find((p) => p.candidate === 'retailleau')
    .entries[0];
  assert.equal(retail.euros, 197e9);
  assert.equal(
    retail.allocation.reduce((n, p) => n + p.value, 0),
    197e9,
  );
  const philippe = budgets.profiles.find((p) => p.candidate === 'philippe')
    .entries[0];
  assert.equal(philippe.allocationUnit, 'pourcentage');
  assert.deepEqual(
    philippe.allocation.map((p) => p.value),
    [50, 25, 25],
  );
  assert.equal(philippe.approximate, true);
  assert.equal(
    budgets.profiles.find((p) => p.candidate === 'glucksmann').entries[0]
      .period,
    'ponctuel',
  );
  for (const mutate of [
    (d) => (d.profiles[0].entries[0].euros = -1),
    (d) =>
      (d.profiles.find(
        (p) => p.candidate === 'retailleau',
      ).entries[0].allocation[0].value = 197e9),
    (d) =>
      (d.profiles.find(
        (p) => p.candidate === 'philippe',
      ).entries[0].allocationUnit = 'euros'),
    (d) => d.profiles[0].entries.push(d.profiles[0].entries[0]),
  ]) {
    const copy = structuredClone(budgets);
    mutate(copy);
    assert.equal(programmeBudgetSchema.safeParse(copy).success, false);
  }
  const copy = structuredClone(agenda);
  copy.events[0].source = 'absente';
  assert.ok(
    validateVisualReferences(
      budgets,
      copy,
      data('candidates'),
      data('sources'),
      data('versions'),
    ).length,
  );
});
test('la période de l’agenda dépend du jour à Paris et les filtres se combinent', () => {
  assert.equal(parisToday(new Date('2026-11-17T23:05:00Z')), '2026-11-18');
  assert.equal(parisToday(new Date('2026-07-01T22:05:00Z')), '2026-07-02');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
  assert.equal(weekStart('2026-11-23'), '2026-11-23');
  const e = agenda.events.find((e) => e.id === 'labib-paris-1128');
  assert.equal(
    agendaMatches(
      e,
      {
        period: 'a-venir',
        candidate: 'labib',
        city: 'paris',
        week: '2026-11-23',
      },
      '2026-11-28',
    ),
    true,
  );
  assert.equal(agendaMatches(e, { period: 'a-venir' }, '2026-11-29'), false);
  assert.equal(agendaMatches(e, { period: 'passes' }, '2026-11-29'), true);
  assert.equal(
    agendaMatches(e, { period: 'tous', candidate: 'arthaud' }, '2026-11-29'),
    false,
  );
  assert.equal(
    agendaMatches(e, { period: 'tous', city: 'pau' }, '2026-11-29'),
    false,
  );
});
test('les contours, repères et groupes restent dans le viewBox', () => {
  for (const p of [
    ...map.rings.flat(),
    ...agenda.cities.map((c) => c.coordinates),
  ]) {
    const { x, y } = projectFrance(p);
    assert.ok(x >= 10 && x <= 490 && y >= 10 && y <= 490);
  }
  const groups = clusterCities(agenda.cities);
  assert.equal(groups.flatMap((g) => g.cities).length, agenda.cities.length);
  for (const g of groups) {
    assert.ok(
      g.x - 21 >= 0 && g.x + 21 <= 500 && g.y - 35 >= 0 && g.y + 21 <= 500,
    );
  }
  const copy = structuredClone(agenda);
  copy.events[0].city = 'inconnue';
  assert.equal(agendaSchema.safeParse(copy).success, false);
  copy.events[0].city = null;
  copy.events[0].time = '25:01';
  assert.equal(agendaSchema.safeParse(copy).success, false);
});
test('les rendez-vous confirmés et leurs sources complémentaires sont vérifiés', () => {
  const next = structuredClone(agenda);
  const row = next.events.find(
    (e) => e.id === 'rohou-presentation-livre-blanc',
  );
  assert.equal(row.status, 'tenu');
  row.additionalSources = ['source-inconnue'];
  assert.ok(
    validateVisualReferences(
      budgets,
      next,
      data('candidates'),
      data('sources'),
    ).some((error) => error.includes('source-inconnue')),
  );
  row.additionalSources = [row.source];
  assert.equal(agendaSchema.safeParse(next).success, false);
  delete row.additionalSources;
  row.date = '2099-01-01';
  assert.equal(agendaSchema.safeParse(next).success, false);
});

test('une enveloppe garde un seul montant, ses postes et ses versions distinctes', () => {
  const base = structuredClone(budgets);
  const envelope = base.profiles
    .flatMap((p) => p.entries)
    .find((e) => e.id === 'mikolajczak-canicules');
  const amount = envelope.euros;
  assert.equal(envelope.review.estimator, 'Équinoxe');
  assert.equal(envelope.period, 'annuel');
  assert.ok(envelope.review.targets.every((t) => t.allocationPart));
  assert.equal(
    base.profiles
      .flatMap((p) => p.entries)
      .filter((e) => e.id === envelope.id)
      .reduce((total, e) => total + e.euros, 0),
    amount,
  );
  const global = base.profiles
    .flatMap((p) => p.entries)
    .find((e) => e.id === 'attal-economies-quinquennat');
  assert.deepEqual(global.review.targets, []);
  assert.equal(global.period, 'pluriannuel');
  assert.equal(global.review.priceYear, undefined);
  envelope.review.targets.push(envelope.review.targets[0]);
  assert.equal(programmeBudgetSchema.safeParse(base).success, false);
  envelope.review.targets.pop();
  envelope.review.targets[0].versionId = 'version-inconnue';
  assert.ok(
    validateVisualReferences(
      base,
      agenda,
      data('candidates'),
      data('sources'),
      data('versions'),
    ).length,
  );
});

test('une annonce passée ne confirme pas la tenue de la réunion', () => {
  const event = {
    status: 'annonce',
    date: '2026-10-10',
    latestPossibleDate: '2026-10-12',
  };
  assert.equal(agendaStatusLabel(event, '2026-10-12'), 'Rendez-vous annoncé');
  assert.equal(
    agendaStatusLabel(event, '2026-10-13'),
    'Annonce passée · tenue non confirmée',
  );
  assert.equal(
    agendaStatusLabel({ ...event, status: 'annule' }, '2026-10-13'),
    'Annulé',
  );
});
