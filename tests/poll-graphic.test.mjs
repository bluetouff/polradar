import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pollGraphic,
  pollGraphicCatalog,
  pollGraphicSeriesId,
} from '../src/lib/poll-graphic.mjs';

const data = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'),
  );
const polls = data('polls');
const sources = data('sources');
const first = polls[0];

test('une adresse actualisée ne mélange ni les questions, ni les hypothèses, ni les populations', () => {
  const id = pollGraphicSeriesId(first);
  assert.match(id, /^serie-[a-f0-9]{64}$/);
  for (const field of [
    'institute',
    'round',
    'method',
    'population',
    'scenario',
    'questionKey',
  ])
    assert.notEqual(
      pollGraphicSeriesId({ ...first, [field]: first[field] + ' bis' }),
      id,
    );
  assert.notEqual(
    pollGraphicSeriesId({ ...first, results: first.results.slice(1) }),
    id,
  );
  assert.equal(
    pollGraphicSeriesId({ ...first, results: [...first.results].reverse() }),
    id,
  );
  assert.equal(
    pollGraphicSeriesId({
      ...first,
      results: first.results.map((r) => ({ ...r, percentage: null })),
    }),
    id,
  );
});

test('la dernière vague repose sur le terrain et reste déterministe dans un corpus réordonné', () => {
  const old = {
    ...first,
    id: 'ancien',
    fieldworkStart: '2026-01-01',
    fieldworkEnd: '2026-01-03',
    published: '2026-02-14',
  };
  const recent = {
    ...first,
    id: 'recent',
    fieldworkStart: '2026-02-01',
    fieldworkEnd: '2026-02-03',
    published: '2026-02-04',
  };
  const reissued = { ...recent, id: 'recent-revu', published: '2026-02-05' };
  const other = { ...old, scenario: 'Autre hypothèse' };
  const rows = [recent, other, old, reissued];
  const catalogue = pollGraphicCatalog(rows);
  assert.deepEqual(catalogue, pollGraphicCatalog([...rows].reverse()));
  assert.deepEqual(catalogue[0].waves, [old, recent, reissued]);
  assert.equal(catalogue[0].latest.id, reissued.id);
  assert.equal(catalogue[1].latest, other);
  assert.equal(rows[0], recent);
  assert.deepEqual(pollGraphicCatalog([]), []);
});

test('le graphique et le texte alternatif couvrent toutes les candidatures et renvoient à la notice et au rapport publiés', () => {
  const catalogue = pollGraphicCatalog(polls);
  assert.equal(catalogue.flatMap((s) => s.waves).length, polls.length);
  for (const poll of polls) {
    const chart = pollGraphic(poll, sources);
    assert.ok(chart.title.includes(poll.scenario));
    assert.ok(chart.alt.includes(poll.institute));
    assert.ok(chart.alt.includes(chart.dateLabel));
    assert.equal(chart.page, '/sondages/#enquete=' + poll.id);
    assert.ok(
      chart.svg.includes(`viewBox="0 0 ${chart.width} ${chart.height}"`),
    );
    assert.match(chart.svg, /role="img" aria-labelledby="titre description"/);
    assert.doesNotMatch(
      chart.svg,
      /<script\b|<image\b|<foreignObject\b|\bhref=|\bonload=/i,
    );
    assert.doesNotMatch(chart.svg, /NaN|Infinity|undefined/);
    for (const result of poll.results)
      assert.ok(chart.alt.includes(result.name + ', '));
    assert.equal(chart.sources.length, poll.resultSource ? 2 : 1);
    const references = [[poll.noticeSource, poll.noticePage]];
    if (poll.resultSource)
      references.push([poll.resultSource, poll.resultPage]);
    for (const [i, [key, page]] of references.entries()) {
      const source = sources.find((item) => item.id === key);
      const url = new URL(source.url);
      url.hash = 'page=' + page;
      assert.equal(chart.sources[i].url, url.href);
    }
    assert.ok(chart.svg.includes('Effectif utile'));
    assert.ok(chart.svg.includes('Population'));
  }
});

test('un seuil, un score absent, zéro et un chiffre décimal publié ont des rendus distincts', () => {
  const results = [
    { id: 'a', name: 'Valeur inconnue', percentage: null },
    { id: 'b', name: 'Seuil publié', percentage: null, below: 0.5 },
    { id: 'c', name: 'Zéro publié', percentage: 0 },
    { id: 'd', name: 'Fraction publiée', percentage: 0.00025 },
  ];
  const chart = pollGraphic({ ...first, results, usefulSample: null }, sources);
  assert.ok(chart.alt.includes('Valeur inconnue, Non publié'));
  assert.ok(chart.alt.includes('Seuil publié, Moins de 0,5 %'));
  assert.ok(chart.alt.includes('Zéro publié, 0 %'));
  assert.ok(chart.alt.includes('Fraction publiée, 0,00025 %'));
  assert.ok(chart.svg.includes('Non précisé pour cette question.'));
  const rows = [
    ...chart.svg.matchAll(/<g><text font-size="18">.*?<\/g>/gs),
  ].map((match) => match[0]);
  assert.equal(rows.length, results.length);
  for (const result of results) {
    const row = rows.find((item) => item.includes(result.name));
    assert.ok(row);
    if (result.percentage === null) assert.doesNotMatch(row, /<rect\b/);
    else assert.match(row, /<rect\b/);
  }
});

test('chaque édition reflète les corrections de résultats et de références, les libellés restent du texte', () => {
  const chart = pollGraphic(first, sources);
  assert.equal(chart.svg, pollGraphic(structuredClone(first), sources).svg);
  const amended = {
    ...first,
    results: first.results.map((r, index) =>
      index ? r : { ...r, percentage: 5 },
    ),
  };
  assert.notEqual(pollGraphic(amended, sources).svg, chart.svg);
  const changedSource = sources.map((s) =>
    s.id === first.noticeSource
      ? { ...s, url: 'https://example.org/notice.pdf?lang=fr&v=2#ancien' }
      : s,
  );
  const revised = pollGraphic(first, changedSource);
  assert.notEqual(revised.svg, chart.svg);
  assert.ok(revised.svg.includes('lang=fr&amp;v=2#page='));
  const marked = pollGraphic(
    {
      ...first,
      scenario: 'Hypothèse <a> & B',
      results: [{ id: 'x', name: 'A < B', percentage: 25 }],
    },
    sources,
  );
  assert.ok(marked.svg.includes('&lt;a&gt; &amp; B'));
  assert.ok(marked.svg.includes('A &lt; B'));
  assert.doesNotMatch(marked.svg, /<a>/);
  assert.throws(() => pollGraphic(first, []), /Référence de sondage invalide/);
  assert.throws(
    () =>
      pollGraphic(first, [
        { id: first.noticeSource, url: 'data:text/html,notice' },
      ]),
    /Référence de sondage invalide/,
  );
  assert.throws(
    () => pollGraphic({ ...first, noticePage: 0 }, sources),
    /Référence de sondage invalide/,
  );
});
