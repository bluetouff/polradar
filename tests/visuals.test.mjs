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
  agendaMatches,
  parisToday,
  weekStart,
  projectFrance,
  clusterCities,
} from '../src/lib/campaign-visuals-view.mjs';
const data = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const airtime = data('airtime'),
  budgets = data('programme-budgets'),
  agenda = data('campaign-agenda'),
  map = data('france-map');
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
    ),
    [],
  );
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
    validateVisualReferences(budgets, copy, data('candidates'), data('sources'))
      .length,
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
