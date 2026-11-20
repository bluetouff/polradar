import { candidates, measureById, sourceById, themes, versions } from './data';
import { positionDivergences } from './divergence-data';
import { digitalLawSections } from './digital-law-data';
import { dailyHistorySchema } from './daily-updates.mjs';
import history from '../data/daily-updates.json';

const journal = dailyHistorySchema.parse(history)[0];
const checks = new Map(
  (journal?.sourceChecks ?? []).map((entry) => [entry.sourceId, entry]),
);
export function latestSourceCheck(id: string) {
  return checks.get(id);
}

const examinedDocuments: Record<
  string,
  { candidate: string; sourceId: string; checked: string; locator: string }[]
> = {
  'fiscalite-csg-salaires': [
    {
      candidate: 'cheve',
      sourceId: 'cheve-remontee-citoyenne',
      checked: '2026-11-20',
      locator:
        'Projet de remontée citoyenne, 22 pages. Le document décrit une organisation des contributions citoyennes.',
    },
    {
      candidate: 'egger',
      sourceId: 'egger-programme-2027',
      checked: '2026-11-20',
      locator:
        'Programme présidentiel de Solution Démocratique, 28 pages. Examen du texte du programme.',
    },
  ],
  'logement-regulation-loyers': [
    {
      candidate: 'lepen',
      sourceId: 'rn-lettre-logement-2026',
      checked: '2026-11-20',
      locator:
        'Lettre ouverte du 21 septembre aux professionnels de l’immobilier. Elle traite notamment de la construction, du logement social, de la rénovation et de l’accès à la propriété.',
    },
  ],
};
const labels: Record<string, string> = {
  'retraites-conditions-depart':
    'À quel âge et après combien de cotisations partir à la retraite ?',
  'retraites-protection-revenus': 'Comment les pensions évolueraient-elles ?',
  'retraites-financement-regimes':
    'Quelle place pour la répartition et la capitalisation ?',
  'travail-salaire-minimum':
    'À quel niveau fixer le SMIC et comment le faire évoluer ?',
  'travail-duree-travail': 'Qui pourrait modifier la durée du travail ?',
  'institutions-declenchement-referendum':
    'Qui pourrait déclencher un référendum ?',
  'climat-production-nucleaire':
    'Quelle place donner au nucléaire dans la production électrique ?',
  'logement-regulation-loyers':
    'Faut-il encadrer les loyers et à quelles conditions ?',
  'sante-installation-medecins':
    'Comment faire venir des médecins dans les déserts médicaux ?',
  'education-acces-etudes':
    'Comment décider des admissions dans le supérieur ?',
  'institutions-logiciels-publics':
    'Quels logiciels choisir pour les administrations ?',
  'fiscalite-transmission-patrimoine':
    'Comment taxer les donations et les successions ?',
  'climat-prix-energie': 'Comment agir sur le prix de l’énergie ?',
  'logement-obligations-parc-social':
    'Quelles obligations de logement social pour les communes ?',
  'institutions-ecrire-constitution':
    'Qui pourrait rédiger ou réviser la Constitution ?',
  'europe-participation-union':
    'Quelle relation entre la France et l’Union européenne ?',
  'travail-demarches-entreprises':
    'Quelles démarches simplifier pour les entreprises ?',
  'institutions-contributions-citoyennes':
    'Comment les citoyens pourraient-ils proposer une décision ?',
  'climat-avenir-eolien': 'Faut-il construire de nouvelles éoliennes ?',
  'fiscalite-csg-salaires':
    'Faut-il baisser ou supprimer la CSG sur les revenus du travail ?',
};
const additions = [
  {
    id: 'agriculture-elevages',
    theme: 'agriculture',
    title: 'Quel modèle d’élevage et quelles règles pour les exploitations ?',
    terms:
      'agriculture élevage intensif reconversion éleveurs bâtiments petites fermes surface cheptel',
    versions: [
      'attal-extension-batiments-elevage-v1',
      'lassalle-exploitations-taille-humaine-v1',
      'markovic-climat-elevage-intensif-v1',
      'markovic-aider-reconversion-eleveurs-v1',
      'melenchon-normes-elevage-v1',
    ],
  },
  {
    id: 'agriculture-ogm',
    theme: 'agriculture',
    title:
      'Quelles règles pour les OGM et les nouvelles techniques génomiques ?',
    terms:
      'agriculture organismes génétiquement modifiés nouvelles techniques génomiques semences NGT NTG',
    versions: ['durif-ogm-v1', 'melenchon-ogm-ntg-v1'],
  },
  {
    id: 'places-prison',
    theme: 'securite',
    title: 'Faut-il construire de nouvelles places de prison ?',
    terms: 'prisons capacité pénitentiaire détention construction',
    versions: [
      'philippe-securite-2-v2',
      'dupont-aignan-places-prison-quinquennat-v1',
      'lisnard-places-prison-v1',
    ],
  },
  {
    id: 'immigration-travail',
    theme: 'immigration',
    title: 'Quelles règles pour l’immigration de travail ?',
    terms: 'travailleurs étrangers séjour titres de séjour points quotas',
    versions: [
      'attal-immigration-1-v2',
      'retailleau-immigration-2-v1',
      'philippot-immigration-oqtf-v1',
    ],
  },
  {
    id: 'regroupement-familial',
    theme: 'immigration',
    title:
      'À quelles conditions une famille pourrait-elle rejoindre un proche en France ?',
    terms: 'regroupement familial immigration familiale',
    versions: [
      'attal-immigration-2-v2',
      'retailleau-immigration-1-v1',
      'philippe-immigration-1-v2',
    ],
  },
  {
    id: 'regularisation-sejour',
    theme: 'immigration',
    title: 'Qui pourrait obtenir une régularisation de séjour ?',
    terms: 'sans-papiers titre de séjour régularisation',
    versions: [
      'retailleau-immigration-regularisations-v1',
      'kazib-immigration-regularisation-v1',
    ],
  },
  {
    id: 'parents-isoles',
    theme: 'social',
    title: 'Quel soutien pour les parents qui élèvent seuls leurs enfants ?',
    terms: 'mères seules familles monoparentales séparation CAF droit au répit',
    versions: [
      'attal-social-2-v2',
      'attal-droit-au-repit-v1',
      'glucksmann-statut-meres-seules-v1',
    ],
  },
  {
    id: 'salaires-enseignants',
    theme: 'education',
    title: 'Comment revaloriser les salaires des enseignants ?',
    terms: 'rémunération professeurs salaires éducation nationale',
    versions: [
      'lisnard-education-salaires-v1',
      'attal-education-hausse-salaire-v2',
      'philippe-education-remuneration-v1',
      'ruffin-education-salaires-enseignants-v1',
    ],
  },
  {
    id: 'aide-ukraine',
    theme: 'europe',
    title: 'La France devrait-elle poursuivre son aide à l’Ukraine ?',
    terms: 'livraisons armes soutien aide militaire diplomatie',
    versions: [
      'lepen-europe-1-v2',
      'attal-europe-ukraine-v1',
      'dupont-aignan-europe-ukraine-v1',
      'philippot-livraisons-ukraine-v1',
    ],
  },
];
const versionMap = new Map(versions.map((v) => [v.id, v]));
function resolveEntry(id: string) {
  const version = versionMap.get(id);
  if (!version) throw new Error('Version de proposition inconnue : ' + id);
  const measure = measureById(version.measureId);
  const candidate = candidates.find((c) => c.id === measure.candidate)!;
  const snap = version.snapshot;
  const refs = snap.sourceRefs
    .map((r) => ({ ...r, source: sourceById(r.sourceId) }))
    .filter(
      ({ source }) =>
        ['campagne', 'parti', 'institution'].includes(source.kind) ||
        !!source.originalFormat,
    );
  if (!refs.length || snap.scope === 'archive')
    throw new Error('Version sans source primaire courante : ' + id);
  const author =
    snap.partyAuthor ??
    (snap.scope === 'parti'
      ? (refs[0].source.publisher ?? candidate.party)
      : candidate.name);
  return { version, measure, candidate, author, refs };
}
interface Definition {
  id: string;
  title: string;
  theme: string;
  terms: string;
  versions: string[];
  related?: { label: string; href: string };
}
const definitions: Definition[] = [
  ...positionDivergences.map((t) => ({
    id: t.id,
    title: labels[t.id] ?? t.label,
    theme: t.theme,
    terms:
      t.label +
      ' ' +
      (t.id === 'fiscalite-csg-salaires'
        ? 'suppression de la CSG contribution sociale généralisée fiche de paie salaires actifs'
        : ''),
    versions: t.positions.flatMap((p) => p.entries.map((e) => e.version.id)),
    related: { label: 'Carte des positions', href: '/divergences/#' + t.id },
  })),
  ...digitalLawSections.flatMap((section) =>
    section.cases.map((item) => ({
      id: 'numerique-' + item.id,
      title: item.question,
      theme: 'numerique',
      terms: section.title + ' ' + item.label + ' ' + item.context,
      versions: item.changes.map((c) => c.versionId),
      related: { label: 'Droit en vigueur et propositions', href: item.href },
    })),
  ),
  ...additions,
];
export const questionThemes = [
  ...themes.map((t) => ({ id: t.id, label: t.label, icon: t.id })),
  { id: 'agriculture', label: 'Agriculture et alimentation', icon: 'climat' },
  { id: 'numerique', label: 'Numérique', icon: 'chiffrement' },
];
export const questions = definitions.map((q) => {
  if (!questionThemes.some((t) => t.id === q.theme))
    throw new Error('Thème inconnu : ' + q.theme);
  const entries = [...new Set(q.versions)]
    .map(resolveEntry)
    .sort(
      (a, b) =>
        candidates.indexOf(a.candidate) - candidates.indexOf(b.candidate) ||
        a.version.snapshot.title.localeCompare(b.version.snapshot.title, 'fr'),
    );
  const candidateIds = [...new Set(entries.map((e) => e.candidate.id))];
  const reviews = (examinedDocuments[q.id] ?? []).map((r) => ({
    ...r,
    source: sourceById(r.sourceId),
  }));
  const coverage: Record<string, string> = {};
  const alerts: Record<string, string> = {};
  function recordChecks(candidate: string, sourceIds: string[]) {
    const states = sourceIds.map((s) => latestSourceCheck(s)?.status);
    const notices = [];
    if (states.includes('modifie')) notices.push('Document à relire');
    if (states.includes('bloque') || states.includes('indisponible'))
      notices.push('Accès automatique en échec');
    if (notices.length) alerts[candidate] = notices.join(' · ');
  }
  for (const id of candidateIds) {
    const positions = entries.filter((e) => e.candidate.id === id);
    recordChecks(
      id,
      positions.flatMap((e) => e.refs.map((r) => r.sourceId)),
    );
    const campaign = positions.filter(
      (e) => e.version.snapshot.scope === 'campagne',
    );
    coverage[id] = campaign.some(
      (e) =>
        e.refs.every((r) => !r.source.originalFormat) ||
        e.refs.some(
          ({ source }) =>
            !source.originalFormat &&
            ['campagne', 'parti'].includes(source.kind),
        ),
    )
      ? 'mesure'
      : campaign.length
        ? 'declaration'
        : positions.some((e) => e.version.snapshot.scope === 'orientation')
          ? 'orientation'
          : 'parti';
  }
  for (const r of reviews) {
    if (
      !r.source ||
      !candidates.some((c) => c.id === r.candidate) ||
      r.candidate in coverage
    )
      throw Error('Revue sans source ou contradictoire : ' + q.id);
    coverage[r.candidate] = 'revue';
    recordChecks(r.candidate, [r.sourceId]);
  }
  return {
    ...q,
    entries,
    candidateIds,
    reviews,
    coverage,
    alerts,
    href: '/questions/' + q.id + '/',
  };
});
if (new Set(questions.map((q) => q.id)).size !== questions.length)
  throw new Error('Identifiant de question dupliqué');
export function questionsForMeasure(id: string) {
  return questions.filter((q) => q.entries.some((e) => e.measure.id === id));
}
