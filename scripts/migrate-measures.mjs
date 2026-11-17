/** One-time lossless migration of the original theme records. Never rerun over an archive. */
import { readFile, writeFile, access } from 'node:fs/promises';
const target = new URL('../src/data/', import.meta.url);
for (const name of ['measures', 'versions', 'watch']) {
  try {
    await access(new URL(`${name}.json`, target));
    throw new Error(`${name}.json exists: migration refused`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const original = JSON.parse(
  await readFile(new URL('engagements.json', target), 'utf8'),
);
const measures = [],
  versions = [];
const timestamp = new Date().toISOString();
for (const item of original) {
  for (const [index, bullet] of item.bullets.entries()) {
    const id = `${item.id}-${index + 1}`;
    const title = /^(Fixer cet|Prévoir un|Annoncer|Diviser par)/.test(bullet)
      ? item.title
      : bullet.replace(/\.$/, '');
    const snapshot = {
      title,
      description: bullet,
      beneficiaries: null,
      timing: null,
      financing: null,
      metrics: [],
      amounts: [],
      sourceRefs: item.sources.map((sourceId) => ({
        sourceId,
        locator: `Dossier initial : ${item.title}`,
      })),
      scope: item.scope,
      edition: item.edition,
      checked: item.checked,
    };
    measures.push({
      id,
      parentId: item.id,
      candidate: item.candidate,
      theme: item.theme,
      revision: 1,
      ...snapshot,
    });
    versions.push({
      id: `${id}-v1`,
      measureId: id,
      number: 1,
      kind: 'import',
      observedOn: item.checked,
      recordedAt: null,
      summary:
        'Reprise de la fiche thématique initiale. La date correspond à la consultation du corpus.',
      snapshot: structuredClone(snapshot),
    });
  }
}
const curationNotes = {
  'melenchon-retraites-1':
    'Ajout de l’âge cible, des annuités, des bénéficiaires et du calendrier annoncé.',
  'melenchon-retraites-2':
    'Bénéficiaires et référence de la mesure sur les pensions minimales précisés.',
  'melenchon-travail-1':
    'Montant mensuel net de 1 700 €, bénéficiaires et calendrier renseignés.',
  'melenchon-travail-2':
    'Durée hebdomadaire de 32 heures structurée pour les métiers pénibles et de nuit.',
  'melenchon-fiscalite-1':
    'Paramètre de 14 tranches et référence de la réforme de l’impôt sur le revenu ajoutés.',
  'philippe-retraites-1':
    'Âge de 65 ans, 45 annuités, transition et exceptions documentés.',
  'philippe-retraites-2':
    'Capitalisation collective et exceptions pour les carrières longues ou l’état de santé précisées.',
  'retailleau-retraites-1':
    'Distinction entre l’ouverture des droits à 63 ans et la garantie du taux plein à 65 ans.',
};
function enrich(id, patch, summary = curationNotes[id]) {
  const measure = measures.find((m) => m.id === id);
  if (!measure) throw Error(id);
  Object.assign(measure, patch, { revision: 2, checked: '2026-11-17' });
  const { id: _, parentId, candidate, theme, revision, ...snapshot } = measure;
  versions.push({
    id: `${id}-v2`,
    measureId: id,
    number: 2,
    kind: 'enrichissement',
    observedOn: '2026-11-17',
    recordedAt: timestamp,
    summary,
    snapshot: structuredClone(snapshot),
  });
}
const metric = (key, label, value, unit, sourceId) => ({
  key,
  label,
  value,
  unit,
  sourceId,
});
const ref = (sourceId, locator) => ({ sourceId, locator });
enrich('melenchon-retraites-1', {
  title: 'Retraite à 60 ans et 40 annuités',
  beneficiaries: 'Assurés concernés par les règles générales de retraite.',
  timing: 'Abrogation de la réforme de 2023, puis retour à la cible annoncée.',
  metrics: [
    metric('age-depart', 'Âge de départ cible', 60, 'ans', 'lfi-social'),
    metric('annuites', 'Durée de cotisation', 40, 'annuités', 'lfi-social'),
  ],
  sourceRefs: [
    ref('lfi-social', 'Section Garantir une retraite digne, mesure clé'),
  ],
});
enrich('melenchon-retraites-2', {
  title: 'Pension minimale au niveau du SMIC revalorisé',
  beneficiaries:
    'Salariés, indépendants et agriculteurs ayant une carrière complète.',
  sourceRefs: [
    ref('lfi-social', 'Section Garantir une retraite digne, premier point'),
  ],
});
enrich('melenchon-travail-1', {
  title: 'SMIC mensuel à 1 700 € net',
  beneficiaries:
    'Salariés rémunérés au salaire minimum ; indexation annoncée dans le privé et la fonction publique.',
  timing: 'Application immédiate annoncée.',
  amounts: [
    {
      label: 'SMIC mensuel annoncé',
      value: 1700,
      unit: '€',
      period: 'mois',
      basis: 'net',
      sourceId: 'lfi-tax',
    },
  ],
  sourceRefs: [ref('lfi-tax', 'Section Augmenter les salaires, mesure clé')],
});
enrich('melenchon-travail-2', {
  title: '32 heures pour les métiers pénibles ou de nuit',
  beneficiaries:
    'Salariés exerçant un métier pénible ou de nuit ; généralisation envisagée par négociation.',
  metrics: [
    metric(
      'heures-semaine',
      'Temps de travail hebdomadaire',
      32,
      'heures',
      'lfi-social',
    ),
  ],
  sourceRefs: [
    ref('lfi-social', 'Section Réduire le temps de travail, mesure clé'),
  ],
});
enrich('melenchon-fiscalite-1', {
  title: 'Impôt sur le revenu à 14 tranches',
  metrics: [
    metric(
      'tranches-ir',
      'Tranches du barème proposé',
      14,
      'tranches',
      'lfi-tax',
    ),
  ],
  sourceRefs: [
    ref('lfi-tax', 'Section Faire la révolution fiscale, mesure clé'),
  ],
});
enrich('philippe-retraites-1', {
  title: 'Retraite à 65 ans et 45 annuités',
  beneficiaries:
    'Assurés concernés par le relèvement, avec exceptions annoncées pour santé et carrières longues.',
  timing: 'Progression annoncée sur moins de dix ans.',
  metrics: [
    metric('age-depart', 'Âge de départ cible', 65, 'ans', 'philippe-pension'),
    metric(
      'annuites',
      'Durée de cotisation',
      45,
      'annuités',
      'philippe-pension',
    ),
  ],
  sourceRefs: [
    ref(
      'philippe-pension',
      'Propositions principales et réponses sur l’âge et les exceptions',
    ),
  ],
});
enrich('philippe-retraites-2', {
  title: 'Capitalisation collective et départs anticipés',
  beneficiaries:
    'Salariés pour la capitalisation ; situations de santé et carrières longues pour les départs anticipés.',
  sourceRefs: [
    ref(
      'philippe-pension',
      'Réponses sur les départs anticipés et la capitalisation',
    ),
  ],
});
enrich('retailleau-retraites-1', {
  title: 'Ouverture des droits à 63 ans, taux plein à 65 ans',
  beneficiaries: 'Assurés concernés par le projet de réforme des retraites.',
  metrics: [
    metric(
      'age-depart',
      'Âge d’ouverture des droits',
      63,
      'ans',
      'retailleau-pension',
    ),
    metric(
      'age-taux-plein',
      'Âge du taux plein garanti',
      65,
      'ans',
      'retailleau-pension',
    ),
  ],
  sourceRefs: [
    ref(
      'retailleau-pension',
      'Mesure 108, ouverture des droits et taux plein garanti',
    ),
  ],
});
await writeFile(
  new URL('measures.json', target),
  JSON.stringify(measures, null, 2) + '\n',
);
await writeFile(
  new URL('versions.json', target),
  JSON.stringify(versions, null, 2) + '\n',
);
await writeFile(new URL('watch.json', target), '[]\n');
console.log(
  `${measures.length} mesures, ${versions.length} versions conservées.`,
);
