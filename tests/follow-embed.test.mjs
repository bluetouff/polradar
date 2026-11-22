import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  retirementCard,
  retirementSnippet,
  liveGraphicPath,
  frozenGraphicPath,
} from '../src/lib/retirement-embed.mjs';
import { retirementComparison } from '../src/lib/retirement-comparison.mjs';
import {
  measureChanges,
  agendaStates,
  ballotStates,
  revisionChanges,
  comparisonChanges,
} from '../src/lib/follow-changes.mjs';
import {
  followWindow,
  withinWindow,
  sharedChange,
} from '../src/lib/follow-window.mjs';

const read = (name) =>
  JSON.parse(
    readFileSync(new URL('../src/data/' + name + '.json', import.meta.url)),
  );
const data = Object.fromEntries(
  ['candidates', 'measures', 'sources', 'versions'].map((k) => [k, read(k)]),
);
const retirement = read('retirement-comparison');
const sources = new Map(data.sources.map((s) => [s.id, s]));
const measures = new Map(data.measures.map((s) => [s.id, s]));
const sha = '0123456789abcdef0123456789abcdef01234567',
  at = '2026-11-22T23:30:00Z';

test('les deux intégrations reprennent les valeurs vérifiées de chaque génération et les SVG archivés sont immuables', () => {
  const archiveDir = new URL(
    '../public/graphiques/retraites/editions/',
    import.meta.url,
  );
  for (const file of readdirSync(archiveDir)) {
    const bytes = readFileSync(new URL(file, archiveDir));
    assert.equal(
      file,
      createHash('sha256').update(bytes).digest('hex') + '.svg',
    );
  }
  for (const cohort of retirement.cohorts) {
    const card = retirementCard(retirement, cohort, data);
    const model = retirementComparison(retirement, cohort, data);
    assert.match(card.svg, /viewBox="0 0 480 610"/);
    assert.doesNotMatch(
      card.svg,
      /<(?:script|foreignObject|image|iframe|style|use)\b|\b(?:href|onload)\s*=/i,
    );
    for (const panel of model.panels)
      for (const row of panel.rows)
        assert.ok(card.summary.includes(row.name + ', ' + row.text));
    const options = {
      page: 'https://polradar.fr' + card.page,
      cohort: cohort.label,
      date: card.date,
      summary: card.summary,
      sources: retirement.legalSources,
    };
    const live = retirementSnippet({
      ...options,
      frozen: false,
      image: liveGraphicPath(cohort.id),
    });
    const fixed = retirementSnippet({
      ...options,
      frozen: true,
      image: frozenGraphicPath(card.svg),
    });
    for (const code of [live, fixed]) {
      assert.match(code, /referrerpolicy="no-referrer"/);
      assert.doesNotMatch(code, /<script|<iframe|utm_|onclick=/i);
    }
    assert.ok(fixed.includes('Édition du ' + card.date));
    assert.ok(fixed.includes(retirement.legalSources[0].url));
    assert.ok(!live.includes(card.date));
    const revised = retirementCard(
      { ...retirement, reviewedOn: '2030-01-01' },
      cohort,
      data,
    );
    assert.notEqual(
      frozenGraphicPath(revised.svg),
      frozenGraphicPath(card.svg),
    );
  }
});
test('les noms restent du texte dans un graphique et son code à copier', () => {
  const cohort = { ...retirement.cohorts[0], label: 'A & B < C " D' };
  const card = retirementCard(retirement, cohort, data);
  assert.ok(card.svg.includes('A &amp; B &lt; C &quot; D'));
  const code = retirementSnippet({
    image: '/image.svg',
    page: 'https://polradar.fr/comparer/retraites/',
    cohort: cohort.label,
    date: card.date,
    sources: [],
    summary: card.summary,
    frozen: true,
  });
  assert.ok(code.includes('A &amp; B &lt; C &quot; D'));
});
test('le suivi calcule 24 h et 7 jours glissants au passage à l’heure d’hiver et garde les dates sans heure à leur précision', () => {
  const now = Date.parse('2026-10-25T23:30:00+01:00');
  const range = followWindow(now, 24);
  assert.deepEqual([range.first, range.last], ['2026-10-25', '2026-10-25']);
  assert.ok(withinWindow({ at: new Date(range.start).toISOString() }, range));
  assert.ok(
    !withinWindow({ at: new Date(range.start - 1).toISOString() }, range),
  );
  assert.ok(!withinWindow({ at: new Date(now + 1).toISOString() }, range));
  assert.ok(!withinWindow({ day: '2026-10-25', at: null }, range));
  const week = followWindow(now, 168);
  assert.ok(withinWindow({ day: '2026-10-22', at: null }, week));
  assert.ok(!withinWindow({ day: week.first, at: null }, week));
  assert.equal(now - week.start, 7 * 86400000);
  const dates = ['2026-10-25'];
  assert.deepEqual(sharedChange('#changement=2026-10-25:vote-exemple', dates), {
    day: dates[0],
    id: 'vote-exemple',
  });
  assert.equal(sharedChange('#depuis-hier', dates), null);
  for (const hash of [
    '#changement=2026-10-25:..%2Fsecret',
    '#changement=2026-10-26:abc',
  ])
    assert.equal(sharedChange(hash, dates).day, null);
});
test('chaque version de mesure distingue correction, programme, ajout et simple consultation, avec la source de chaque état', () => {
  const first = structuredClone(data.versions[0]),
    m = measures.get(first.measureId);
  const otherRef = data.sources.find(
    (s) => s.id !== first.snapshot.sourceRefs[0].sourceId,
  );
  const next = {
    ...first,
    id: 'deux',
    number: 2,
    kind: 'programme',
    recordedAt: at,
    snapshot: {
      ...first.snapshot,
      description: 'Nouveau texte de test.',
      sourceRefs: [{ sourceId: otherRef.id, locator: 'Page de test' }],
    },
  };
  const third = {
    ...next,
    id: 'trois',
    number: 3,
    kind: 'enrichissement',
    snapshot: { ...next.snapshot, checked: '2026-11-23' },
  };
  const correction = {
    ...third,
    id: 'quatre',
    number: 4,
    kind: 'correction',
    snapshot: { ...third.snapshot, partyAuthor: 'Auteur de test' },
  };
  const rows = measureChanges({
    measures: [m],
    sources: data.sources,
    versions: [first, next, third, correction],
  });
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Mesure ajoutée', 'Proposition modifiée', 'Fiche corrigée'],
  );
  assert.equal(rows[0].before, null);
  assert.equal(rows[0].at, null);
  assert.equal(rows[1].day, '2026-11-23');
  assert.equal(
    rows[1].before.fields.find((f) => f.label === 'Proposition').text,
    first.snapshot.description,
  );
  assert.equal(
    rows[1].before.sources[0].url,
    sources.get(first.snapshot.sourceRefs[0].sourceId).url,
  );
  assert.equal(rows[1].after.sources[0].url, otherRef.url);
  assert.equal(rows[1].after.sources[0].locator, 'Page de test');
  assert.ok(rows[2].after.fields.some((f) => f.text === 'Auteur de test'));
});
test('un déplacement d’agenda conserve les deux dates, les lieux et sources, sans inventer une heure ni un événement lors d’un enrichissement des sources', () => {
  const current = read('campaign-agenda');
  const event = current.events.find((e) => e.id === 'kazib-paris-1121');
  function state(patch) {
    return agendaStates(
      { cities: current.cities, events: [{ ...event, ...patch }] },
      sources,
    );
  }
  const a = state({ status: 'annonce', time: null, additionalSources: [] }),
    b = state({ status: 'annonce', time: null });
  assert.deepEqual(revisionChanges('agenda', a, b, sha, at), []);
  const moved = state({
    status: 'annonce',
    time: null,
    date: '2026-12-08',
    latestPossibleDate: null,
    venue: 'Salle de test',
  });
  const [change] = revisionChanges('agenda', a, moved, sha, at);
  assert.equal(change.day, '2026-11-23');
  assert.deepEqual(
    change.after.fields.map((f) => f.label),
    ['Rendez-vous', 'Lieu'],
  );
  assert.match(change.before.fields[0].text, /21 novembre/);
  assert.equal(change.after.fields[0].text, '8 décembre 2026');
  assert.equal(change.after.sources[0].url, change.before.sources[0].url);
  const [removed] = revisionChanges('agenda', a, new Map(), sha, at);
  assert.equal(removed.after, null);
  assert.equal(removed.href, '/agenda/');
  const unsafe = new Map(sources);
  unsafe.set(event.source, {
    ...unsafe.get(event.source),
    url: 'javascript:example',
  });
  assert.throws(() =>
    agendaStates({ cities: current.cities, events: [event] }, unsafe),
  );
});
test('une position de vote nominative ne se répète pas entre dossiers et chaque comparaison garde les deux documents', () => {
  const votes = read('legislative-votes'),
    dossier = votes.cases[0],
    link = dossier.links[0],
    ballot = votes.ballots.find((b) => b.id === link.ballotId);
  const state = ballotStates(
    {
      cases: [
        { ...dossier, links: [link] },
        { ...dossier, id: 'second', links: [link] },
      ],
      ballots: [ballot],
    },
    measures,
  );
  assert.equal(state.size, 1);
  const [entry] = revisionChanges('vote', new Map(), state, sha, at);
  assert.equal(entry.candidate, dossier.candidate);
  assert.equal(entry.before, null);
  assert.equal(entry.after.sources[0].url, ballot.source.url);
  assert.match(entry.context, /scrutin du/);
  const evolution = read('proposal-evolution'),
    seen = new Set();
  const changes = comparisonChanges(evolution, seen, at);
  assert.equal(
    changes.length,
    evolution.tracks.reduce((n, t) => n + t.stateIds.length - 1, 0),
  );
  assert.deepEqual(comparisonChanges(evolution, seen, at), []);
  const track = evolution.tracks[0],
    from = evolution.states.find((s) => s.id === track.stateIds[0]),
    to = evolution.states.find((s) => s.id === track.stateIds[1]);
  assert.equal(changes[0].before.sources[0].url, from.source.url);
  assert.equal(changes[0].after.sources[0].locator, to.source.locator);
  assert.ok(changes[0].after.fields[0].text.includes(to.edition));
});
