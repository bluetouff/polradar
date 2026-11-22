import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attributionLabel,
  collectiveLabel,
  documentCredit,
  unspecifiedCollective,
} from '../src/lib/attribution.mjs';
import { documentAuthorsSchema } from '../src/lib/schema.mjs';
import {
  exportCsv,
  measureSearchText,
  metricGroups,
} from '../src/lib/features.mjs';
import authors from '../src/data/document-authors.json' with { type: 'json' };
import measures from '../src/data/measures.json' with { type: 'json' };
import engagements from '../src/data/engagements.json' with { type: 'json' };
import candidates from '../src/data/candidates.json' with { type: 'json' };
import sources from '../src/data/sources.json' with { type: 'json' };

test('la signature vérifiée prime sur le rattachement au dossier', () => {
  for (const row of [...measures, ...engagements]) {
    const name = candidates.find((c) => c.id === row.candidate).name;
    const label = attributionLabel(row, name);
    if (row.partyAuthor) assert.equal(label, row.partyAuthor);
    else if (row.scope !== 'parti') assert.equal(label, name);
    else {
      const ids = row.sourceRefs?.map((r) => r.sourceId) ?? row.sources;
      const credits = ids.map((id) => authors[id]?.author);
      assert.equal(
        label,
        credits[0] && credits.every((v) => v === credits[0])
          ? credits[0]
          : unspecifiedCollective,
      );
    }
  }
  for (const [id, credit] of Object.entries(
    documentAuthorsSchema.parse(authors),
  )) {
    assert.ok(sources.some((s) => s.id === id));
    assert.ok(credit.locator);
  }
  const known = measures.find((m) => m.id === 'glucksmann-europe-1');
  assert.equal(collectiveLabel(known), 'Place publique');
  assert.equal(
    attributionLabel({ ...known, scope: 'campagne' }, 'Raphaël Glucksmann'),
    'Raphaël Glucksmann',
  );
  const signed = measures.find(
    (m) => m.id === 'dupont-aignan-institutions-audit-ministeres',
  );
  assert.equal(collectiveLabel(signed), 'Maël Camerlynck (Debout la France)');
});

test('le premier éditeur, une référence inconnue ou le prototype ne peuvent attribuer une fiche', () => {
  assert.equal(documentCredit('__proto__'), null);
  for (const ids of [
    [],
    ['toString'],
    ['pp-project', 'inconnu'],
    ['pp-project', 'pcf-securite-numerique'],
    ['inconnu', 'pp-project'],
  ]) {
    assert.equal(
      collectiveLabel({ scope: 'parti', sources: ids }),
      unspecifiedCollective,
    );
  }
  assert.equal(
    collectiveLabel({
      scope: 'parti',
      sources: ['lisnard-project', 'lisnard-health'],
    }),
    'Nouvelle Énergie',
  );
  assert.equal(
    collectiveLabel({ scope: 'archive', partyAuthor: 'Signature historique' }),
    'Signature historique',
  );
  assert.equal(
    documentAuthorsSchema.safeParse({
      id: { author: '', locator: 'p. 2', checked: '2026-02-30' },
    }).success,
    false,
  );
});

test('recherche, export et graphiques distinguent le dossier et la signature', () => {
  const m = measures.find((r) => r.id === 'philippot-europe-organisations');
  assert.match(
    measureSearchText(m, 'Florian Philippot', 'Europe'),
    /Les Patriotes · Dossier de Florian Philippot/,
  );
  const csv = exportCsv([
    {
      title: m.title,
      type: 'mesure',
      candidate: m.candidate,
      author: collectiveLabel(m),
      url: '/mesures/' + m.id + '/',
    },
  ]);
  assert.match(csv, /"philippot"/);
  assert.match(csv, /"Auteur du document"/);
  assert.match(csv, /"Les Patriotes"/);
  for (const group of metricGroups(measures, candidates)) {
    for (const value of group.values) {
      const row = measures.find((r) => r.id === value.measureId);
      assert.equal(
        value.name,
        attributionLabel(
          row,
          candidates.find((c) => c.id === row.candidate).name,
        ),
      );
    }
  }
});
