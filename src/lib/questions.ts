import { attributionLabel } from './attribution.mjs';
import {
  candidates,
  measureById,
  sourceById,
  themes,
  versions,
  watch,
} from './data';
import { positionDivergences } from './divergence-data';
import { digitalLawSections } from './digital-law-data';
import { dailyHistorySchema } from './daily-updates.mjs';
import history from '../data/daily-updates.json';

const journal = dailyHistorySchema.parse(history)[0];
const checks = new Map(
  (journal?.sourceChecks ?? []).map((entry) => [entry.sourceId, entry]),
);
for (const entry of watch) {
  const previous = checks.get(entry.sourceId);
  if (!previous || Date.parse(entry.checkedAt) > Date.parse(previous.checkedAt))
    checks.set(entry.sourceId, entry);
}
export function latestSourceCheck(id: string) {
  return checks.get(id);
}

const examinedDocuments: Record<
  string,
  { candidate: string; sourceId: string; checked: string; locator: string }[]
> = {
  'retraites-conditions-depart': [
    {
      candidate: 'villepin',
      sourceId: 'villepin-chapitre-153',
      checked: '2026-11-25',
      locator:
        'Chapitre 16, proposition 161. Le texte prévoit une concertation et ne fixe ni âge de départ ni durée de cotisation.',
    },
  ],
  'soins-de-proximite': [
    {
      candidate: 'polony',
      sourceId: 'polony-vision',
      checked: '2026-11-23',
      locator:
        'Ma vision pour la France, passages sur l’hôpital et les services publics. Aucun dispositif d’accès local aux soins identifié dans ce texte.',
    },
  ],
  'mobilite-territoires': [
    {
      candidate: 'collovati',
      sourceId: 'collovati-projet-2027',
      checked: '2026-11-23',
      locator:
        'Programme, mesures par ministère. La lecture du projet n’a pas livré de dispositif de transport de proximité.',
    },
    {
      candidate: 'polony',
      sourceId: 'polony-vision',
      checked: '2026-11-23',
      locator:
        'Ma vision pour la France, déclaration de campagne. Pas de dispositif de transport local identifié dans ce document.',
    },
  ],
  'logement-offre-bati': [
    {
      candidate: 'polony',
      sourceId: 'polony-vision',
      checked: '2026-11-23',
      locator:
        'Ma vision pour la France, texte de la candidate. Aucun mécanisme de production ou de remise en usage de logements identifié.',
    },
  ],
  'numerique-signalement-cyber': [
    {
      candidate: 'retailleau',
      sourceId: 'retailleau-vauban-numerique',
      checked: '2026-11-22',
      locator:
        'Plan Vauban, engagement sur les administrations et hôpitaux et pilotage par l’ANSSI.',
    },
    {
      candidate: 'melenchon',
      sourceId: 'lfi-numerique',
      checked: '2026-11-22',
      locator:
        'Chapitre 7, passages sur les fuites de données, la formation et la transmission à des tiers.',
    },
    {
      candidate: 'dupont-aignan',
      sourceId: 'dlf-cybersecurite-etat',
      checked: '2026-11-22',
      locator:
        'Communiqué du 25 août 2026. Le rapport annuel demandé au Parlement porte sur la sécurité des ministères.',
    },
    {
      candidate: 'attal',
      sourceId: 'renaissance-convention-regalien',
      checked: '2026-11-22',
      locator:
        'Convention de Renaissance, proposition 25, p. 24. Elle porte sur le guichet des victimes, distinct de la notification obligatoire par les organismes.',
    },
    {
      candidate: 'glucksmann',
      sourceId: 'ps-projet-2027-securites',
      checked: '2026-11-22',
      locator:
        'Projet du PS, section « Cybersécurité : une nouvelle frontière », sur le service public de prévention.',
    },
    {
      candidate: 'ruffin',
      sourceId: 'ruffin-numerique',
      checked: '2026-11-22',
      locator:
        'Cahier numérique, passages sur les données de l’État et les conditions d’hébergement.',
    },
  ],
  'numerique-acces-communications': [
    {
      candidate: 'melenchon',
      sourceId: 'lfi-numerique',
      checked: '2026-11-22',
      locator:
        'Chapitre 7. Le droit constitutionnel au chiffrement proposé ne précise ni les agents habilités ni les conditions d’une réquisition.',
    },
    {
      candidate: 'dupont-aignan',
      sourceId: 'dlf-cybersecurite-etat',
      checked: '2026-11-22',
      locator:
        'Point sur les communications sécurisées. L’obligation proposée vise l’équipement en outils souverains des personnels sensibles.',
    },
    {
      candidate: 'retailleau',
      sourceId: 'retailleau-vauban-numerique',
      checked: '2026-11-22',
      locator:
        'Mesure présidentielle sur les cyberattaques. Son intervention comme ministre en mars 2025 figure dans le dossier parlementaire.',
    },
  ],
  'numerique-courtiers': [
    {
      candidate: 'glucksmann',
      sourceId: 'ps-projet-2027-vivre-libres',
      checked: '2026-11-22',
      locator:
        'Le volet sur les plateformes encadre la publicité ciblée et les fils personnalisés.',
    },
    {
      candidate: 'melenchon',
      sourceId: 'lfi-numerique',
      checked: '2026-11-22',
      locator:
        'Le chapitre 7 aborde la transmission de données sensibles à des tiers et le consentement au traitement.',
    },
  ],
  'numerique-identite-numerique': [
    {
      candidate: 'dupont-aignan',
      sourceId: 'dlf-cybersecurite-etat',
      checked: '2026-11-22',
      locator:
        'Les paragraphes sur l’euro numérique et les données de l’État portent sur d’autres usages.',
    },
  ],
  'numerique-portabilite': [
    {
      candidate: 'glucksmann',
      sourceId: 'ps-projet-2027-vivre-libres',
      checked: '2026-11-22',
      locator:
        'Volet sur les grandes plateformes et la transparence de leurs algorithmes. La portabilité des droits sociaux relève d’un autre chapitre.',
    },
  ],
  'numerique-hebergement-sante': [
    {
      candidate: 'retailleau',
      sourceId: 'retailleau-vauban-numerique',
      checked: '2026-11-22',
      locator:
        'La fiche Vauban traite de la sécurité des hôpitaux et des hébergements sensibles, sans préciser une nouvelle règle pour les hébergeurs de données de santé.',
    },
  ],
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
  'soins-de-proximite': 'Comment rapprocher les soins des habitants ?',
  'mobilite-territoires': 'Comment se déplacer au quotidien en milieu rural ?',
  'handicap-accompagnement-ecole':
    'Quel statut pour les accompagnants des élèves en situation de handicap ?',
  'statuts-outre-mer':
    'Comment les territoires ultramarins pourraient-ils choisir leur statut ?',
  'logement-offre-bati':
    'Comment produire des logements ou remettre le bâti en usage ?',
  'regularisation-sejour':
    'Qui pourrait obtenir une régularisation de séjour ?',
  'regroupement-familial':
    'À quelles conditions une famille pourrait-elle rejoindre un proche en France ?',
  'sante-remboursement-soins':
    'Quelle part des frais de santé resterait à payer ?',
  'social-garde-jeunes-enfants':
    'Comment financer la garde des jeunes enfants et accéder à une crèche ?',
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
    id: 'retraites-penibilite',
    theme: 'retraites',
    title: 'Quels départs anticipés pour les métiers pénibles ?',
    terms: 'pénibilité usure professionnelle départ anticipé carrières longues',
    versions: [
      'delmur-penibilite-depart-v1',
      'kazib-retraites-age-v1',
      'philippe-faire-negocier-les-criteres-de-penibilite-par-les-partenaires-sociaux-v1',
      'ps-retraites-age-cotisation-v1',
      'retailleau-confier-aux-branches-le-financement-des-amenagements-de-fin-de-carriere-v1',
    ],
  },
  {
    id: 'retraites-regimes-particuliers',
    theme: 'retraites',
    title: 'Que deviendraient les régimes spéciaux de retraite ?',
    terms: 'régimes particuliers régimes spéciaux droits pension',
    versions: [
      'egger-retraites-regimes-speciaux-v1',
      'herlin-regimes-speciaux-v1',
    ],
  },
  {
    id: 'agriculture-remuneration-contrats',
    theme: 'agriculture',
    title: 'Comment améliorer la rémunération des agriculteurs ?',
    terms:
      'agriculture prix planchers coûts de production contrats volumes producteurs revenus aides environnement grande distribution fruits légumes transparence',
    related: {
      label: 'Lire le dossier sur le prix payé aux agriculteurs',
      href: '/dossiers/revenu-agricole-prix-contrats/',
    },
    versions: [
      'attal-prix-planchers-agricoles-v1',
      'billetdoux-remuneration-agriculteurs-v1',
      'dupont-aignan-double-prix-fruits-legumes-v1',
      'lr-contrats-volumes-prix-agricoles-v1',
      'mei-contrats-eau-sols-agriculteurs-v1',
      'melenchon-prix-planchers-producteurs-v1',
      'place-publique-regulation-revenus-agricoles-v1',
      'ps-prix-minimums-agricoles-v1',
      'villepin-contrats-prix-volumes-agricoles-v1',
      'villepin-statut-fermes-familiales-v1',
    ],
  },
  {
    id: 'agriculture-cantines',
    theme: 'agriculture',
    title: 'Qui paierait la cantine et quels produits y servirait-on ?',
    terms:
      'cantines scolaires gratuité prix repas végétariens menus circuits courts achats publics restauration collective produits locaux poisson bio',
    related: {
      label: 'Voir les achats réels et les règles des cantines',
      href: '/dossiers/cantines-achats-menus-prix/',
    },
    versions: [
      'equinoxe-repas-vegetariens-collectivite-v1',
      'lr-marches-publics-cantines-lots-v1',
      'melenchon-education-1-v1',
      'place-publique-achats-circuits-courts-v1',
      'ps-peche-locale-etablissements-scolaires-v1',
    ],
  },
  {
    id: 'agriculture-installation-fermes',
    theme: 'agriculture',
    title: 'Comment reprendre une ferme ou accéder à la terre ?',
    terms:
      'jeunes agriculteurs installation reprise transmission foncier terres bail rural Safer préemption prêts ferme familiale',
    versions: [
      'attal-extension-batiments-elevage-v1',
      'lr-louer-terres-acquerir-equipement-v1',
      'lr-transmission-fermes-impot-differe-v1',
      'melenchon-preemption-installation-fermes-v1',
      'ps-foncier-premiere-installation-v1',
      'villepin-statut-fermes-familiales-v1',
    ],
  },
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
    versions: [
      'ecologistes-interdiction-ntg-v1',
      'durif-ogm-v1',
      'melenchon-ogm-ntg-v1',
    ],
  },
  {
    id: 'places-prison',
    theme: 'securite',
    title: 'Faut-il construire de nouvelles places de prison ?',
    terms: 'prisons capacité pénitentiaire détention construction',
    related: {
      label: 'Voir le graphique des places annoncées',
      href: '/divergences/#securite-places-prison-supplementaires',
    },
    versions: [
      'ps-prisons-renovation-construction-v1',
      'patriotes-nouvelles-places-prison-v1',
      'philippe-securite-2-v2',
      'dupont-aignan-places-prison-quinquennat-v1',
      'lisnard-places-prison-v1',
      'groupe-rn-construction-places-prison-v1',
    ],
  },
  {
    id: 'immigration-travail',
    theme: 'immigration',
    title: 'Quelles règles pour l’immigration de travail ?',
    terms: 'travailleurs étrangers séjour titres de séjour points quotas',
    versions: [
      'lisnard-immigration-1-v1',
      'ps-sejour-contrat-six-mois-v1',
      'ecologistes-regularisation-criteres-v1',
      'melenchon-sejour-travailleurs-etudiants-parents-v1',
      'attal-immigration-1-v2',
      'retailleau-immigration-2-v1',
      'philippot-immigration-oqtf-v1',
    ],
  },
  {
    id: 'parents-isoles',
    theme: 'social',
    title: 'Quel soutien pour les parents qui élèvent seuls leurs enfants ?',
    terms: 'mères seules familles monoparentales séparation CAF droit au répit',
    versions: [
      'ps-statut-familles-monoparentales-v1',
      'ecologistes-pmi-familles-monoparentales-v1',
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
      'asselineau-arret-aides-ukraine-v1',
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
  const author = attributionLabel(snap, candidate.name);
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
const complementaryVersions: Record<string, string[]> = {
  'soins-de-proximite': [
    'equinoxe-tripler-structures-mobiles-soins-v1',
    'dlf-hopital-quarante-cinq-minutes-v1',
  ],
  'sante-installation-medecins': [
    'dlf-bourse-medecins-zones-sous-dotees-v1',
    'branco-sante-implantation-medicale-v1',
  ],
  'sante-remboursement-soins': [
    'branco-sante-assurance-unique-v1',
    'branco-remboursement-soins-dentaires-v1',
    'branco-remboursement-psychologues-examen-national-v1',
  ],
  'institutions-declenchement-referendum': ['dlf-ric-millions-inscrits-v1'],
  'europe-participation-union': ['dlf-referendum-appartenance-ue-v1'],
  'institutions-logiciels-publics': [
    'dlf-logiciels-administrations-licences-gratuites-v1',
  ],
  'agriculture-remuneration-contrats': ['dlf-prix-garantis-agricoles-v1'],
  'agriculture-installation-fermes': [
    'dlf-garantie-installation-agricole-v1',
    'dlf-reformer-safer-v1',
  ],
  'agriculture-cantines': [
    'dlf-achats-publics-agricoles-v1',
    'melenchon-cantines-bio-local-option-vegetarienne-v1',
  ],
  'logement-obligations-parc-social': [
    'dlf-accession-sociale-quota-sru-v1',
    'dlf-seuil-logements-sociaux-communes-v1',
  ],
  'logement-offre-bati': [
    'dlf-conversion-bureaux-plu-v1',
    'melenchon-construction-logements-publics-et-jeunes-v1',
  ],
  'salaires-enseignants': [
    'dlf-salaires-nets-professeurs-quinze-v1',
    'branco-salaires-enseignants-debut-carriere-v1',
  ],
  'institutions-ecrire-constitution': [
    'mathieu-convention-controle-impartialite-v1',
    'mlekuz-garants-constituante-v1',
    'mlekuz-constituante-apres-refus-v1',
  ],
  'institutions-contributions-citoyennes': [
    'cheve-question-reponse-publique-v1',
    'cheve-deposer-soutenir-avis-v1',
  ],
  'retraites-protection-revenus': [
    'attal-petites-retraites-inflation-v1',
    'dlf-regimes-retraite-agricole-v1',
  ],
  'retraites-financement-regimes': [
    'attal-interessement-vers-epargne-retraite-v1',
    'philippe-plan-epargne-premier-emploi-v1',
  ],
  'logement-regulation-loyers': ['melenchon-blocage-loyers-urgence-sociale-v1'],
  'social-garde-jeunes-enfants': [
    'dlf-places-creches-cinq-ans-v1',
    'attal-social-professionnels-enfance-v1',
  ],
};
const searchTerms: Record<string, string> = {
  'logement-obligations-parc-social': 'logement social communes loi SRU',
  'fiscalite-csg-salaires':
    'suppression de la CSG contribution sociale généralisée fiche de paie salaires actifs salaire brut revenu brut',
  'regroupement-familial': 'regroupement familial immigration familiale',
  'regularisation-sejour': 'sans-papiers titre de séjour régularisation',
};
const definitions: Definition[] = [
  ...positionDivergences.map((t) => ({
    id: t.id,
    title: labels[t.id] ?? t.label,
    theme: t.theme,
    terms: [t.label, searchTerms[t.id]].filter(Boolean).join(' '),
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
  const entries = [
    ...new Set([...q.versions, ...(complementaryVersions[q.id] ?? [])]),
  ]
    .map(resolveEntry)
    .filter((entry) => !entry.candidate.withdrawnOn)
    .sort(
      (a, b) =>
        candidates.indexOf(a.candidate) - candidates.indexOf(b.candidate) ||
        a.version.snapshot.title.localeCompare(b.version.snapshot.title, 'fr'),
    );
  const candidateIds = [...new Set(entries.map((e) => e.candidate.id))];
  const reviews = (examinedDocuments[q.id] ?? [])
    .filter((r) =>
      candidates.some((c) => c.id === r.candidate && !c.withdrawnOn),
    )
    .map((r) => ({
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
