import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { eurostatLinks, labelPeriod } from '../src/lib/economy.mjs';
import { economyGraphic } from '../src/lib/economy-graphic.mjs';

const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const config = load('economy-series');
const snapshot = load('economy');
const economy = config.map((definition) => ({
  ...definition,
  ...snapshot.series.find(({ id }) => id === definition.id),
  links: eurostatLinks(definition, snapshot.since),
}));
function fromPoints(observations, overrides = {}) {
  const series = {
    ...economy[0],
    frequency: 'M',
    updatedAt: '2026-10-01T22:30:00Z',
    observations,
    ...overrides,
  };
  return economyGraphic([series], series.id);
}

test('chaque graphique reprend le périmètre, la source et la dernière observation publiée', () => {
  for (const series of economy) {
    const card = economyGraphic(economy, series.id);
    assert.equal(card.page, `/economie/${series.id}/`);
    assert.equal(card.title, series.title);
    assert.deepEqual(
      card.sources.map((s) => s.url),
      [series.links.table, series.links.api],
    );
    assert.ok(card.alt.includes(series.description));
    assert.ok(card.svg.includes(`Eurostat · ${series.dataset}`));
    assert.ok(card.svg.includes(series.updatedAt));
    const lastValue = series.observations.findLast(
      ([, value]) => value !== null,
    );
    assert.ok(card.alt.includes(labelPeriod(lastValue[0])));
    assert.ok(card.svg.includes(`Évolution en ${series.unit}`));
    assert.ok(card.svg.includes(`viewBox="0 0 ${card.width} ${card.height}"`));
    assert.doesNotMatch(
      card.svg,
      /<script\b|<foreignObject\b|\shref=|\son\w+=|NaN|Infinity/,
    );
  }
  assert.throws(() => economyGraphic(economy, 'inconnu'), /inconnu/);
});

test('les périodes absentes, les valeurs nulles et les ruptures Eurostat interrompent la courbe', () => {
  const card = fromPoints([
    ['2026-01', '0', ''],
    ['2026-02', '-1.20', ''],
    ['2026-03', null, ''],
    ['2026-04', '1.20', ''],
    ['2026-05', '1.30', ''],
    ['2026-07', '7.50', ''],
    ['2026-08', '7.40', ''],
    ['2026-09', '4.90', 'b'],
    ['2026-10', '4.50', 'p'],
    ['2026-11', null, ''],
  ]);
  assert.equal(
    [...card.svg.matchAll(/<polyline points="([^"]+)"/g)]
      .map((m) => m[1].split(' ').length)
      .join(','),
    '2,2,2,2',
  );
  assert.equal([...card.svg.matchAll(/fill="url\(#lacune\)"/g)].length, 3);
  assert.ok(card.svg.includes('>0</text>'));
  assert.ok(card.svg.includes('>4,50 %</text>'));
  assert.ok(card.svg.includes('Dernière valeur · oct. 2026 · provisoire'));
  assert.ok(card.svg.includes('nov. 2026 indisponible'));
  assert.ok(card.svg.includes('rupture de série Eurostat'));
  assert.equal(card.dateLabel, '2 octobre 2026');
  assert.ok(card.svg.includes('2 octobre 2026 à 00:30 (Paris)'));
});

test('un point isolé ou des zéros réels ont une position finie ; un relevé vide reste indisponible', () => {
  const one = fromPoints([['2026-01', '0.00', '']]);
  assert.ok(one.svg.includes('>0,00 %</text>'));
  assert.doesNotMatch(one.svg, /NaN|Infinity|<polyline|fill="url\(#lacune\)"/);
  const flat = fromPoints(
    [
      ['2024', '-2.0', ''],
      ['2025', '-2.0', ''],
    ],
    { frequency: 'A' },
  );
  const line = /<polyline points="([\d.]+),([\d.]+) ([\d.]+),([\d.]+)"/.exec(
    flat.svg,
  );
  assert.ok(line);
  assert.equal(line[2], line[4]);
  assert.ok(Number(line[1]) < Number(line[3]));
  for (const missing of [[], [['2026-01', null, '']]]) {
    const card = fromPoints(missing);
    assert.ok(card.svg.includes('Donnée indisponible'));
    assert.doesNotMatch(card.svg, /<polyline|>0 %</);
    assert.ok(card.alt.includes('Aucune observation chiffrée'));
  }
});

test('une révision change le fichier et conserve le décimal source et sa précision', () => {
  const older = fromPoints([['2026-01', '9999999999999.1200000002', '']]);
  const revised = fromPoints([['2026-01', '9999999999999.1200000001', '']]);
  assert.notEqual(older.svg, revised.svg);
  assert.ok(revised.alt.includes('9 999 999 999 999,1200000001 %'));
  assert.equal(
    revised.svg,
    fromPoints([['2026-01', '9999999999999.1200000001', '']], {
      collectedAt: '2026-10-03T12:00:00Z',
    }).svg,
  );
});

test('les libellés du corpus sont échappés dans le SVG autonome', () => {
  const card = fromPoints([['2026-01', '1', '']], {
    title: 'A&B <test>',
    description: 'Un texte <exemple>.',
  });
  assert.ok(card.svg.includes('A&amp;B &lt;test&gt;'));
  assert.ok(card.svg.includes('Un texte &lt;exemple&gt;.'));
  assert.doesNotMatch(card.svg, /<test>|<exemple>/);
});
