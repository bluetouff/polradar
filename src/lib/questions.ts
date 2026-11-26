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
    'Que proposent les candidats pour les salariés au SMIC ?',
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
      'markovic-aider-reconversion-eleveurs-v2',
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
    terms:
      'aide financière humanitaire livraisons soutien militaire diplomatie Ukraine',
    versions: [
      'lepen-europe-1-v2',
      'glucksmann-renforcer-aide-ukraine-v1',
      'philippe-poursuivre-soutien-financier-operationnel-ukraine-v1',
      'lisnard-soutenir-ukraine-livraisons-materiel-v1',
      'melenchon-lfi-poursuivre-aide-defense-ukraine-v1',
      'melenchon-proteger-les-sites-nucleaires-ukrainiens-sous-egide-onu-v1',
      'villepin-inscrire-le-soutien-a-lukraine-dans-la-duree-v1',
      'attal-europe-ukraine-v1',
      'dupont-aignan-europe-ukraine-v1',
      'philippot-livraisons-ukraine-v1',
      'asselineau-arret-aides-ukraine-v1',
    ],
  },
  {
    id: 'france-otan',
    theme: 'europe',
    title: 'Quelle place pour la France dans l’OTAN ?',
    terms: 'Alliance atlantique traité commandement intégré pilier européen',
    versions: [
      'melenchon-retirer-la-france-de-lotan-par-etapes-v1',
      'branco-europe-otan-referendum-v1',
      'asselineau-notification-retrait-otan-v1',
      'saforcada-quitter-commandement-integre-otan-v1',
      'marchal-sortie-progressive-otan-v1',
      'villepin-constituer-un-pilier-europeen-de-defense-dans-lotan-v1',
      'bonnal-quitter-otan-v1',
    ],
  },
  {
    id: 'immigration-aide-medicale-etat',
    theme: 'immigration',
    title: 'Que faire de l’aide médicale de l’État ?',
    terms:
      'AME maintien suppression aide urgence soins personnes sans titre de séjour',
    versions: [
      'melenchon-integrer-laide-medicale-detat-au-regime-general-v1',
      'ps-maintenir-laide-medicale-detat-v1',
      'groupe-rn-ame-aide-urgence-v1',
      'retailleau-supprimer-ame-et-maintenir-certains-soins-v1',
      'saforcada-ame-urgence-v1',
      'zemmour-suppression-ame-v1',
      'bonnal-ame-soins-urgents-v1',
    ],
  },
  {
    id: 'immigration-droit-sol',
    theme: 'immigration',
    title: 'Faut-il modifier l’accès à la nationalité par le droit du sol ?',
    terms:
      'nationalité française droit du sol naissance enfants nés en France dix-huit ans Mayotte',
    versions: [
      'retailleau-immigration-droit-sol-v2',
      'ecologistes-accorder-le-droit-du-sol-aux-enfants-nes-en-france-quelle-que-soit-la-situat-v1',
      'philippe-supprimer-lautomaticite-de-lacquisition-de-la-nationalite-v1',
      'philippe-suspendre-le-droit-du-sol-a-mayotte-pendant-plusieurs-annees-v1',
      'herlin-droit-sol-v1',
      'marchal-reformer-droit-sol-v1',
      'bonnal-supprimer-droit-du-sol-v1',
    ],
  },
  {
    id: 'education-eleves-par-classe',
    theme: 'education',
    title: 'Faut-il réduire le nombre d’élèves par classe ?',
    terms:
      'effectifs par classe primaire maternelle élémentaire zones éducation prioritaire écoliers',
    versions: [
      'melenchon-education-2-v3',
      'ps-viser-un-maximum-de-19-eleves-par-classe-v2',
      'ecologistes-viser-19-eleves-par-classe-dans-le-primaire-en-2032-v1',
      'ecologistes-limiter-a-douze-eleves-les-classes-de-primaire-en-education-prioritaire-v2',
      'philippe-diminuer-les-effectifs-par-classe-dans-le-premier-degre-v2',
    ],
  },
  {
    id: 'sante-aide-a-mourir',
    theme: 'sante',
    title: 'Les candidats veulent-ils modifier la loi sur l’aide à mourir ?',
    terms: 'aide à mourir fin de vie loi août 2026 abrogation référendum',
    versions: ['bonnal-abroger-loi-aide-a-mourir-v1'],
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
  explanations?: Record<string, string>;
  relatedByVersion?: Record<string, string>;
}
const additionalAnswers: Record<string, string[]> = {
  'retraites-conditions-depart': [
    'tinland-taux-plein-55-60-v1',
    'lepen-fixer-un-plancher-de-160-trimestres-v1',
    'revillon-apreval-retraite-socle-70-puis-85-ans-v2',
    'lepen-cantonner-trimestres-chomage-v1',
    'lepen-abroger-reforme-retraites-2023-en-2028-v1',
    'lisnard-age-legal-retraite-65-ans-v1',
    'bonnal-taux-plein-retraite-41-annuites-v1',
  ],
  'travail-salaire-minimum': [
    'tinland-revaloriser-smic-v1',
    'bonnal-smic-revalorisation-automatique-v1',
    'glucksmann-revaloriser-smic-1700-net-v1',
  ],
  'travail-duree-travail': [
    'tinland-reduire-duree-travail-v1',
    'platret-retour-39-heures-v1',
    'villepin-reserver-aux-partenaires-sociaux-certains-choix-sur-les-salaires-et-le-temps-de-v1',
    'ecologistes-passer-a-32-heures-sans-baisse-de-salaire-pour-les-metiers-penibles-ou-de-nu-v1',
    'lisnard-temps-de-travail-accords-v1',
    'ps-experimenter-la-semaine-de-quatre-jours-par-la-negociation-collective-v1',
  ],
  'climat-production-nucleaire': [
    'tinland-sortie-nucleaire-solaire-v1',
    'marchal-construire-centrales-nucleaires-v1',
    'bouamrane-nucleaire-geothermie-sortie-fossiles-v1',
    'attal-plan-messmer-2-v1',
    'villepin-poursuivre-le-programme-de-six-reacteurs-epr2-v1',
    'melenchon-fermer-les-centrales-nucleaires-et-arreter-les-epr2-v1',
    'lisnard-prolonger-reacteurs-nucleaires-60-ans-v1',
    'lisnard-nouveaux-epr-et-mini-reacteurs-v1',
  ],
  'climat-prix-energie': [
    'tinland-tva-energie-5-5-v1',
    'melenchon-retablir-tarifs-reglementes-energie-couts-production-v1',
    'arthaud-climat-carburant-coutant-v1',
    'marchal-accord-operateurs-carburants-v1',
    'delmur-tarif-social-energie-v1',
    'attal-stabilite-prix-electricite-v1',
    'retailleau-stabiliser-le-prix-de-lelectricite-par-un-contrat-a-double-sens-v1',
    'philippe-baisser-prix-electricite-industriels-v1',
    'villepin-encadrer-le-prix-des-carburants-par-la-fiscalite-v1',
    'lalanne-fiscalite-taxes-carburants-v1',
    'lepen-renegocier-prix-electricite-europe-v3',
    'glucksmann-moratoire-hausses-taxes-electricite-v1',
  ],
  'fiscalite-csg-salaires': [
    'saforcada-reduire-csg-salaires-deux-tranches-v1',
    'lisnard-baisser-csg-revenus-activite-66-v1',
    'melenchon-fusionner-les-cotisations-sociales-et-la-csg-v1',
  ],
  'fiscalite-transmission-patrimoine': [
    'philippe-perenniser-defiscalisation-donations-premier-achat-v1',
    'herlin-droits-succession-v1',
    'collovati-relever-le-seuil-dimposition-des-successions-v1',
    'philippot-petits-heritages-v1',
    'mikolajczak-mettre-fin-a-leffacement-des-plus-values-latentes-lors-dune-succession-v1',
    'groupe-rn-successions-immobilier-300000-v2',
    'becht-exonerer-de-droits-de-succession-le-capital-maintenu-sept-ans-dans-le-fonds-ma-v1',
    'billetdoux-heritage-bareme-v1',
    'glucksmann-grands-heritages-v2',
    'glucksmann-imposer-plus-values-latentes-transmises-v1',
    'lisnard-exonerer-transmission-entreprises-droits-succession-v1',
    'lisnard-ramener-taux-marginal-succession-20-v1',
  ],
  'regularisation-sejour': [
    'labib-regulariser-tous-les-sans-papiers-v1',
    'philippe-soumettre-les-regularisations-massives-a-un-accord-entre-etats-schengen-v1',
    'lisnard-interdire-regularisation-apres-entree-clandestine-v1',
  ],
  'immigration-travail': [
    'lepen-taxe-embauche-extracommunautaires-v1',
    'legendre-exiger-une-demande-prealable-a-lambassade-pour-limmigration-economique-v1',
    'bonnal-regularisation-cas-par-cas-metiers-en-tension-v1',
    'dupont-aignan-conditionner-limmigration-economique-au-niveau-du-chomage-v1',
    'philippe-introduire-des-quotas-dimmigration-selon-les-profils-recherches-v1',
    'groupe-rn-creer-une-taxe-a-lembauche-dun-salarie-extra-europeen-v2',
  ],
  'soins-de-proximite': [
    'tinland-soins-proximite-medecins-v1',
    'philippe-obligation-solidarite-medecins-v1',
    'philippe-equipes-soins-traitantes-v1',
    'philippe-renforcer-missions-infirmiers-pharmaciens-v1',
    'batho-installation-medecins-centres-sante-v1',
    'ecologistes-ouvrir-2-000-centres-de-sante-supplementaires-dici-2030-v1',
    'ps-sante-centres-salaries-v1',
    'equinoxe-tripler-structures-mobiles-soins-v1',
    'dlf-hopital-quarante-cinq-minutes-v1',
    'melenchon-vacations-deserts-medicaux-v1',
    'groupe-rn-supprimer-communautes-professionnelles-sante-v1',
    'lisnard-communautes-soignantes-echelle-anciens-cantons-v1',
  ],
  'sante-installation-medecins': [
    'philippe-reguler-installation-medecins-si-echec-v1',
    'philippe-former-medecins-assistants-infirmiers-v1',
    'tinland-soins-proximite-medecins-v1',
    'batho-installation-medecins-centres-sante-v1',
    'dlf-bourse-medecins-zones-sous-dotees-v1',
    'branco-sante-implantation-medicale-v1',
    'melenchon-guichet-installation-soignants-v1',
  ],
  'sante-remboursement-soins': [
    'tinland-soins-gratuits-v1',
    'philippe-adapter-remboursements-apport-traitements-v1',
    'philippe-plafonner-depassements-honoraires-v1',
    'legendre-remboursement-soins-v1',
    'bonnal-augmenter-franchises-medicales-participations-v1',
    'mikolajczak-revoir-le-remboursement-des-medicaments-selon-leur-service-medical-rendu-v1',
    'roussel-remboursement-integral-securite-sociale-v2',
    'dupont-aignan-reexaminer-le-remboursement-des-medicaments-selon-leur-benefice-v1',
    'branco-sante-assurance-unique-v1',
    'branco-remboursement-soins-dentaires-v1',
    'branco-remboursement-psychologues-examen-national-v1',
  ],
  'institutions-declenchement-referendum': [
    'tinland-referendum-populaire-un-pour-cent-v1',
    'lisnard-referendum-initiative-populaire-v1',
    'dubuisson-referendum-decisions-essentielles-v2',
    'saforcada-ric-local-v1',
    'pic-ric-toutes-matieres-v1',
    'becht-referendum-initiative-citoyenne-v1',
    'ecologistes-creer-un-referendum-dinitiative-citoyenne-pour-proposer-ou-abroger-une-loi-v1',
    'mlekuz-institutions-referendum-ouverture-v1',
    'lalanne-institutions-ric-v1',
    'dlf-ric-millions-inscrits-v1',
    'place-publique-droit-initiative-referendum-v1',
  ],
  'europe-participation-union': [
    'tinland-referendum-union-europeenne-v1',
    'lepen-commission-au-service-des-etats-v1',
    'lepen-refuser-elargissement-ue-v1',
    'melenchon-rester-dans-union-et-euro-negocier-traites-v1',
    'lisnard-traite-pouvoirs-conseil-parlement-europeen-v1',
    'place-publique-traiter-elargissement-refondation-ue-2030-v1',
    'dlf-referendum-appartenance-ue-v1',
  ],
  'institutions-logiciels-publics': [
    'dlf-logiciels-administrations-licences-gratuites-v1',
  ],
  'agriculture-remuneration-contrats': [
    'lepen-agriculture-prix-installation-jeunes-v1',
    'lisnard-services-environnementaux-agriculteurs-v2',
    'lisnard-charges-agricoles-valeur-ajoutee-v2',
    'legendre-revenu-minimum-agriculteurs-v1',
    'patriotes-garantir-des-prix-planchers-aux-agriculteurs-v1',
    'dlf-prix-garantis-agricoles-v1',
  ],
  'agriculture-installation-fermes': [
    'lepen-agriculture-prix-installation-jeunes-v1',
    'tinland-fermes-circuits-courts-v1',
    'dlf-garantie-installation-agricole-v1',
    'dlf-reformer-safer-v1',
  ],
  'agriculture-cantines': [
    'tinland-restauration-collective-locale-v1',
    'delmur-cantines-locales-bio-v1',
    'pic-prix-plancher-agricole-v1',
    'ps-adapter-le-prix-de-la-cantine-aux-revenus-des-familles-jusquau-lycee-v1',
    'dlf-achats-publics-agricoles-v1',
    'melenchon-cantines-bio-local-option-vegetarienne-v1',
  ],
  'logement-obligations-parc-social': [
    'tinland-maires-permis-logements-sociaux-v1',
    'bonnal-maintenir-quotas-loi-sru-v1',
    'roussel-sru-30-logements-sociaux-v1',
    'dlf-accession-sociale-quota-sru-v1',
    'dlf-seuil-logements-sociaux-communes-v1',
    'lisnard-supprimer-article-55-de-la-loi-sru-v1',
  ],
  'logement-offre-bati': [
    'tinland-construction-sociale-v1',
    'tinland-mobiliser-logements-vides-v1',
    'lepen-objectif-cent-mille-logements-sociaux-v1',
    'lisnard-densifier-liberer-foncier-public-v1',
    'polony-logements-sociaux-intermediaires-foncier-public-outre-mer-v1',
    'roussel-logement-construction-v1',
    'lepen-logement-foncier-public-v3',
    'becht-faciliter-la-reconversion-des-friches-et-des-bureaux-vacants-en-logements-v1',
    'tondelier-logement-logements-vacants-v1',
    'dlf-conversion-bureaux-plu-v1',
    'melenchon-construction-logements-publics-et-jeunes-v1',
    'glucksmann-construction-sociale-v2',
    'philippe-construire-quatre-millions-de-logements-en-dix-ans-v1',
  ],
  'salaires-enseignants': [
    'melenchon-negocier-grilles-enseignants-rattraper-indice-v1',
    'glucksmann-revaloriser-salaire-enseignants-10-25-v1',
    'polony-hausse-remuneration-enseignants-vingt-trente-v1',
    'mikolajczak-relever-le-salaire-des-professeurs-des-ecoles-de-200-euros-nets-par-mois-v1',
    'retailleau-relever-le-salaire-des-enseignants-en-debut-et-milieu-de-carriere-v1',
    'becht-formation-remuneration-enseignants-v2',
    'ecologistes-augmenter-de-15-en-cinq-ans-le-salaire-des-enseignants-v1',
    'dlf-salaires-nets-professeurs-quinze-v1',
    'branco-salaires-enseignants-debut-carriere-v1',
  ],
  'education-acces-etudes': [
    'lepen-publier-criteres-admission-superieur-v1',
    'lisnard-remplacer-parcoursup-orientation-v1',
    'philippe-conserver-ameliorer-parcoursup-orientation-v1',
    'roussel-remplacer-parcoursup-monmaster-v1',
    'becht-remplacer-parcoursup-par-une-epreuve-dadmission-liee-a-la-specialite-v1',
    'place-publique-abroger-parcoursup-etats-generaux-orientation-v1',
  ],
  'institutions-ecrire-constitution': [
    'mathieu-institutions-convention-500-v1',
    'mathieu-convention-controle-impartialite-v1',
    'mlekuz-garants-constituante-v1',
    'mlekuz-constituante-apres-refus-v1',
  ],
  'institutions-contributions-citoyennes': [
    'tinland-consultations-publiques-v1',
    'lisnard-referendum-initiative-populaire-v1',
    'place-publique-droit-initiative-referendum-v1',
    'mathieu-consultations-territoires-v1',
    'mlekuz-institutions-contributions-ouvertes-v1',
    'cheve-proposition-argumentee-v1',
    'cheve-consulter-les-citoyens-a-la-demande-de-letat-v1',
    'cheve-question-reponse-publique-v1',
    'cheve-deposer-soutenir-avis-v1',
  ],
  'retraites-protection-revenus': [
    'philippe-maintenir-montant-pensions-v1',
    'tinland-indexation-pensions-reversion-v1',
    'glucksmann-revaloriser-petites-pensions-carrieres-hachees-v1',
    'arthaud-travail-indexation-v1',
    'roussel-garantir-un-montant-de-pension-au-moins-egal-au-smic-v1',
    'labib-indexer-pensions-v1',
    'arthaud-revenu-minimum-retraites-chomage-invalidite-v1',
    'attal-petites-retraites-inflation-v1',
    'dlf-regimes-retraite-agricole-v1',
    'lepen-retraites-indexation-cinq-ans-v2',
    'lisnard-envisager-sous-indexation-certaines-pensions-si-deficit-persiste-v1',
    'ps-garantir-85-du-smic-apres-une-carriere-entiere-dans-lagriculture-v1',
  ],
  'retraites-financement-regimes': [
    'pic-retraites-capitalisation-collective-v1',
    'attal-interessement-vers-epargne-retraite-v1',
    'philippe-plan-epargne-premier-emploi-v1',
  ],
  'logement-regulation-loyers': [
    'tinland-loyers-15-pour-cent-v1',
    'delmur-encadrement-loyers-v1',
    'melenchon-blocage-loyers-urgence-sociale-v1',
    'philippe-donner-aux-maires-la-decision-sur-lencadrement-des-loyers-v1',
  ],
  'social-garde-jeunes-enfants': [
    'tinland-conge-parental-et-garde-v1',
    'philippe-plan-garde-enfants-v1',
    'branco-rendre-opposable-le-droit-a-une-place-en-creche-v1',
    'villepin-planifier-les-places-daccueil-de-la-petite-enfance-par-territoire-v1',
    'dlf-places-creches-cinq-ans-v1',
    'attal-social-professionnels-enfance-v1',
    'glucksmann-soustraire-creches-ehpad-logique-marchande-v1',
    'place-publique-contrat-creches-privees-v1',
  ],
  'france-otan': [
    'tinland-otan-v1',
    'lepen-sortir-commandement-integre-otan-v1',
    'lalanne-europe-otan-v1',
    'philippot-europe-organisations-v1',
    'legendre-maintenir-renforcer-alliances-dont-otan-v1',
  ],
  'retraites-regimes-particuliers': [
    'marchal-agir-regimes-speciaux-pensions-hautes-v1',
  ],
  'retraites-penibilite': [
    'bouamrane-adapter-age-depart-a-penibilite-v1',
    'roussel-ouvrir-des-departs-anticipes-pour-les-metiers-penibles-et-les-carrieres-longue-v1',
  ],
  'climat-avenir-eolien': [
    'tinland-arreter-eolien-v1',
    'retailleau-interrompre-des-appels-doffres-solaires-et-eoliens-en-mer-v1',
    'melenchon-refuser-les-parcs-solaires-et-eoliens-qui-exigent-une-coupe-rase-v1',
  ],
  'regroupement-familial': [
    'herlin-regroupement-familial-v1',
    'becht-limiter-le-regroupement-familial-pour-les-personnes-hors-union-europeenne-v1',
    'dupont-aignan-restreindre-le-regroupement-familial-et-supprimer-le-regime-derogatoire-des-re-v1',
  ],
  'handicap-accompagnement-ecole': [
    'attal-corps-professionnel-aesh-v1',
    'roussel-aesh-des-la-rentree-v1',
    'branco-aesh-concours-titularisation-v1',
    'becht-revaloriser-les-accompagnants-deleves-en-situation-de-handicap-et-ouvrir-davan-v1',
    'dlf-aesh-temps-plein-v1',
  ],
  'parents-isoles': [
    'delmur-pension-alimentaire-salaire-v1',
    'becht-confier-une-mission-daide-aux-familles-monoparentales-aux-maisons-de-vie-v1',
    'melenchon-creer-statut-famille-monoparentale-v1',
  ],
  'places-prison': [
    'zemmour-prisons-100000-places-v1',
    'herlin-places-prison-v1',
    'becht-places-prisons-haute-securite-v1',
  ],
  'agriculture-ogm': ['tinland-interdire-ogm-v1', 'lisnard-autoriser-ntg-v2'],
  'statuts-outre-mer': [
    'villepin-permettre-aux-territoires-ultramarins-de-choisir-une-evolution-vers-lautonomie-v1',
    'melenchon-statut-collectivite-unique-v1',
  ],
  'mobilite-territoires': ['lisnard-investir-infrastructures-des-enclaves-v1'],
  'numerique-demarches-en-ligne': [
    'dubuisson-eviter-redemande-documents-administratifs-v2',
    'pic-droits-services-hors-ligne-v1',
    'dlf-accessibilite-services-publics-numeriques-v1',
    'ecologistes-garantir-un-accueil-physique-de-service-public-a-quinze-minutes-v1',
  ],
  'immigration-droit-sol': [
    'tinland-citoyennete-residence-nationalite-v1',
    'melenchon-garantir-droit-du-sol-integral-v1',
    'lepen-supprimer-droit-du-sol-parti-v1',
  ],
  'immigration-aide-medicale-etat': [
    'lisnard-remplacer-ame-par-aide-medicale-urgence-v1',
  ],
  'education-eleves-par-classe': [
    'glucksmann-reduire-eleves-classes-du-primaire-v1',
  ],
  'travail-demarches-entreprises': ['tinland-alleger-fiscalite-entreprises-v1'],
};
const scopedComplements: Record<string, Record<string, string>> = {
  'climat-production-nucleaire': {
    'lepen-renegocier-prix-electricite-europe-v3':
      'Le tract prend pour base la production nucléaire et hydraulique française pour fixer le prix intérieur de l’électricité.',
    'lepen-relancer-euratom-reacteurs-francais-v1':
      'La proposition porte sur la construction de réacteurs français dans les pays européens. Le passage ne fixe pas de capacité de production supplémentaire en France.',
  },
  'travail-salaire-minimum': {
    'lisnard-exoneration-emploi-domicile-smic-v1':
      'L’exonération concerne les charges de l’employeur à domicile lorsque le salarié est payé au SMIC.',
    'philippe-travail-2-v2':
      'La fiche concerne les prélèvements et les cotisations sur les heures supplémentaires.',
  },
  'numerique-acces-communications': {
    'melenchon-droit-constitutionnel-chiffrement-v1':
      'La proposition inscrit la protection du chiffrement dans la Constitution. Les conditions d’accès aux communications sont traitées dans le dossier juridique.',
  },
  'numerique-signalement-cyber': {
    'renaissance-guichet-signalement-cyber-v1':
      'Le guichet proposé par Renaissance vise les signalements des victimes de cyberattaques.',
  },
  'aide-ukraine': {
    'philippe-soutenir-ladhesion-de-lukraine-a-lotan-v1':
      'L’adhésion à l’OTAN est un volet distinct du soutien envisagé. La proposition ne précise pas le contenu de l’aide française.',
    'riner-interroger-consequences-aide-ukraine-v1':
      'Teddy Riner dit que la France resterait aux côtés des pays opprimés. Dans cet échange, il renvoie à son futur programme pour les modalités de l’aide.',
  },
  'france-otan': {
    'philippe-soutenir-ladhesion-de-lukraine-a-lotan-v1':
      'Le volet défense soutient l’adhésion de l’Ukraine à l’Alliance. Ce passage ne se prononce pas sur le commandement intégré français.',
  },
  'retraites-financement-regimes': {
    'dubuisson-capitalisation-dans-modele-paie-v1':
      'Le prélèvement de 10 % figure dans une simulation de paie. Le document ne fixe pas le régime applicable à l’ensemble des revenus.',
  },
  'travail-duree-travail': {
    'groupe-rn-appliquer-35-heures-fonction-publique-territoriale-v1':
      'Cette disposition du contre-budget vise la fonction publique territoriale. La durée légale pour les autres salariés n’est pas traitée dans ce passage.',
  },
  'parents-isoles': {
    'tinland-soutien-financier-familles-v1':
      'La mesure ciblée sur les parents isolés en difficulté concerne la protection maternelle et infantile à domicile.',
  },
  'retraites-penibilite': {
    'lepen-preserver-carrieres-longues-plus-favorables-v1':
      'Le passage prévoit de conserver le dispositif des carrières longues quand il est plus favorable. Les critères d’un départ propre aux métiers pénibles ne sont pas détaillés.',
    'tinland-taux-plein-55-60-v1':
      'Le chapitre annonce des aménagements pour les métiers les plus pénibles. Il ne donne pas l’âge ni les critères propres à ces départs.',
  },
  'climat-avenir-eolien': {
    'glucksmann-climat-doublement-renouvelables-v2':
      'Le livret fixe un objectif pour l’ensemble des énergies renouvelables. La capacité propre à l’éolien reste à préciser.',
    'groupe-rn-fiscalite-eolien-foncier-mer-v1':
      'Le contre-budget du groupe parlementaire traite de la fiscalité de l’éolien. Le passage ne fixe pas le nombre de nouveaux parcs.',
    'philippe-climat-1-v3':
      'Le volet énergie défend le développement des renouvelables là où elles sont jugées efficaces. Il ne fixe pas d’objectif propre à l’éolien.',
    'herlin-demantelement-eolien-solaire-v1':
      'La proposition porte sur les installations existantes. Elle aide à situer l’orientation du candidat sur ces équipements.',
  },
  'institutions-ecrire-constitution': {
    'mathieu-consultations-territoires-v1':
      'Le candidat prévoit des contributions du public aux travaux. La composition de la convention est documentée dans une fiche distincte.',
  },
  'statuts-outre-mer': {
    'batho-etats-generaux-outre-mer-v1':
      'La candidate propose une concertation avec la société civile ultramarine. Le passage ne fixe pas de nouveau statut institutionnel.',
    'tinland-autonomie-outre-mer-v1':
      'Le chapitre défend l’autonomie économique des territoires ultramarins. Il ne donne pas le mode de consultation ni le statut proposé territoire par territoire.',
  },
  'immigration-aide-medicale-etat': {
    'legendre-questionner-ame-sans-reforme-v1':
      'Le manifeste critique le dispositif. Il ne précise pas le sort de l’AME ni les soins qui resteraient couverts.',
  },
  'regroupement-familial': {
    'legendre-interroger-pays-regroupement-familial-v1':
      'Le manifeste questionne le pays de regroupement. Il ne formule pas de nouvelle condition.',
  },
  'sante-aide-a-mourir': {
    'lisnard-prioriser-soins-palliatifs-2025-v1':
      'L’entretien date de janvier 2025 et précède l’adoption de la loi du 18 août 2026. Il documente une position dans le débat antérieur.',
    'saforcada-referendum-fin-de-vie-v1':
      'David Saforcada propose un débat et un référendum sur la fin de vie. La charte n’indique pas quelle modification apporter à la loi.',
  },
  'mobilite-territoires': {
    'batho-reduire-dependance-voiture-v1':
      'La candidate prévoit des investissements pour réduire la dépendance à la voiture. Le volet ne choisit pas de service local de transport à développer.',
  },
  'soins-de-proximite': {
    'dubuisson-dossier-medical-pros-autorises-v1':
      'La proposition concerne le partage des informations entre les professionnels qui interviennent dans les soins.',
  },
};
const searchTerms: Record<string, string> = {
  'logement-obligations-parc-social': 'logement social communes loi SRU',
  'fiscalite-csg-salaires':
    'suppression de la CSG contribution sociale généralisée fiche de paie salaires actifs salaire brut revenu brut',
  'regroupement-familial': 'regroupement familial immigration familiale',
  'regularisation-sejour': 'sans-papiers titre de séjour régularisation',
};
// These subject phrases identify a precise question. Search terms can be broader.
export const questionAnswerAliases: Record<string, string[]> = {
  'aide-ukraine': ['aide à l’Ukraine', 'aide française à l’Ukraine'],
  'france-otan': ['OTAN', 'place de la France dans l’OTAN'],
  'europe-participation-union': [
    'sortie de l’Union européenne',
    'sortir de l’Union européenne',
    'prévoit-il de sortir de l’Union européenne',
    'rester dans l’Union européenne',
    'Frexit',
  ],
  'retraites-conditions-depart': [
    'âge légal de la retraite',
    'âge de départ à la retraite',
    'conditions de départ à la retraite',
    'taux plein à la retraite',
  ],
  'retraites-penibilite': [
    'pénibilité des carrières',
    'retraite pour les métiers pénibles',
  ],
  'retraites-regimes-particuliers': ['régimes spéciaux de retraite'],
  'retraites-protection-revenus': [
    'montant des pensions',
    'niveau des pensions',
  ],
  'retraites-financement-regimes': [
    'répartition et capitalisation',
    'retraite par capitalisation',
    'financement des retraites',
  ],
  'travail-salaire-minimum': ['SMIC', 'hausse du SMIC'],
  'travail-duree-travail': [
    'temps de travail',
    'durée légale du travail',
    '35 heures',
  ],
  'fiscalite-csg-salaires': [
    'CSG des salaires',
    'baisse de la CSG des salaires',
    'CSG sur les revenus du travail',
  ],
  'fiscalite-transmission-patrimoine': [
    'droits de succession',
    'fiscalité des successions',
  ],
  'climat-production-nucleaire': [
    'nucléaire',
    'production d’électricité nucléaire',
  ],
  'climat-avenir-eolien': ['nouvelles éoliennes', 'développement de l’éolien'],
  'climat-prix-energie': ['prix de l’énergie', 'prix de l’électricité'],
  'sante-remboursement-soins': [
    'remboursement des soins',
    'reste à charge en santé',
  ],
  'sante-installation-medecins': [
    'installation des médecins',
    'installation des médecins dans les déserts médicaux',
    'contre les déserts médicaux',
  ],
  'soins-de-proximite': ['accès aux soins de proximité', 'soins de proximité'],
  'logement-regulation-loyers': ['encadrement des loyers'],
  'logement-obligations-parc-social': [
    'loi SRU',
    'quotas de logements sociaux',
  ],
  'logement-offre-bati': ['construction de logements', 'offre de logements'],
  'regroupement-familial': ['regroupement familial'],
  'regularisation-sejour': ['régularisation des sans-papiers'],
  'immigration-travail': [
    'immigration de travail',
    'immigration professionnelle',
  ],
  'institutions-declenchement-referendum': [
    'référendum d’initiative citoyenne',
    'RIC',
    'déclenchement du référendum',
  ],
  'institutions-ecrire-constitution': [
    'rédaction de la Constitution',
    'Assemblée constituante',
  ],
  'institutions-contributions-citoyennes': [
    'initiatives citoyennes',
    'participation aux décisions publiques',
  ],
  'social-garde-jeunes-enfants': [
    'places de crèche',
    'garde des jeunes enfants',
  ],
  'parents-isoles': [
    'aides aux parents isolés',
    'soutien aux familles monoparentales',
  ],
  'education-acces-etudes': [
    'Parcoursup',
    'admission dans l’enseignement supérieur',
  ],
  'salaires-enseignants': [
    'salaires des enseignants',
    'rémunération des professeurs',
  ],
  'handicap-accompagnement-ecole': ['statut des AESH'],
  'places-prison': ['places de prison', 'construction de prisons'],
  'agriculture-cantines': ['cantines scolaires'],
  'agriculture-remuneration-contrats': ['rémunération des agriculteurs'],
  'immigration-aide-medicale-etat': [
    'AME',
    'aide médicale de l’État',
    'aide médicale d’État',
  ],
  'immigration-droit-sol': ['droit du sol'],
  'education-eleves-par-classe': [
    'élèves par classe',
    'nombre d’élèves par classe',
    'effectifs par classe',
  ],
  'sante-aide-a-mourir': ['aide à mourir', 'loi sur l’aide à mourir'],
  'agriculture-elevages': ['élevage intensif', 'avenir de l’élevage'],
  'agriculture-ogm': ['OGM', 'nouvelles techniques génomiques'],
  'statuts-outre-mer': ['statut des outre-mer', 'statuts ultramarins'],
  'mobilite-territoires': ['transports de proximité'],
  'numerique-demarches-en-ligne': [
    'démarches administratives en ligne',
    'démarches en ligne',
  ],
};
const definitions: Definition[] = [
  ...positionDivergences.map((t) => ({
    id: t.id,
    title: labels[t.id] ?? t.label,
    theme: t.theme,
    terms: [t.label, searchTerms[t.id]].filter(Boolean).join(' '),
    versions: t.positions.flatMap((p) => p.entries.map((e) => e.version.id)),
    explanations: Object.fromEntries(
      t.positions.flatMap((p) =>
        p.entries.map((e) => [e.version.id, p.label + '. ' + t.context]),
      ),
    ),
    related: { label: 'Carte des positions', href: '/divergences/#' + t.id },
  })),
  ...digitalLawSections.flatMap((section) =>
    section.cases.map((item) => ({
      id: 'numerique-' + item.id,
      title: item.question,
      theme: 'numerique',
      terms: section.title + ' ' + item.label + ' ' + item.context,
      versions: item.changes.map((c) => c.versionId),
      explanations: Object.fromEntries(
        item.changes.map(({ versionId, body }) => [versionId, body]),
      ),
      relatedByVersion: Object.fromEntries(
        (item.relatedMeasures ?? []).map((id) => [
          id,
          'Le dossier juridique cite ce passage en complément.',
        ]),
      ),
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

export type QuestionProposalRelation = {
  id: string;
  type: 'question-proposition';
  origin: { id: string; type: 'question'; url: string };
  target: { id: string; type: 'version'; url: string };
  qualification: 'reponse' | 'complement';
  justification: string;
  date: { type: 'observation-version'; value: string };
  statut: 'version-courante' | 'version-depassee';
  versionCitee: string;
  versionCourante: string;
  regleVersion: 'version-citee';
  sources: { id: string; url: string; passage: string }[];
};

export const questions = definitions.map((q) => {
  if (!questionThemes.some((t) => t.id === q.theme))
    throw new Error('Thème inconnu : ' + q.theme);
  const href = '/questions/' + q.id + '/';
  const answers = new Set([...q.versions, ...(additionalAnswers[q.id] ?? [])]);
  const context = new Map(
    Object.entries({ ...q.relatedByVersion, ...scopedComplements[q.id] }),
  );
  for (const versionId of context.keys()) {
    if (answers.has(versionId))
      throw new Error(
        'Version déclarée comme réponse et complément : ' + versionId,
      );
  }
  const relatedEntries = [...answers, ...context.keys()]
    .map((id) => {
      const entry = resolveEntry(id);
      const { measure, version, refs } = entry;
      const current = versionMap.get(measure.id + '-v' + measure.revision);
      if (!current || current.measureId !== version.measureId)
        throw new Error('Version courante introuvable : ' + measure.id);
      const relation: QuestionProposalRelation = {
        id: `question-proposition:${q.id}:${id}`,
        type: 'question-proposition',
        origin: { id: q.id, type: 'question', url: href },
        target: {
          id,
          type: 'version',
          url: `/mesures/${measure.id}/#version-${version.number}`,
        },
        qualification: context.has(id) ? 'complement' : 'reponse',
        justification:
          context.get(id) ??
          q.explanations?.[id] ??
          'Le dossier retient cette proposition comme réponse à la question. Le lien ouvre le passage cité.',
        date: { type: 'observation-version', value: version.observedOn },
        statut: id === current.id ? 'version-courante' : 'version-depassee',
        versionCitee: id,
        versionCourante: current.id,
        regleVersion: 'version-citee',
        sources: refs.map(({ source, locator, fragment }) => ({
          id: source.id,
          url: fragment
            ? source.url.split('#')[0] + '#' + fragment
            : source.url,
          passage: locator,
        })),
      };
      return { ...entry, relation };
    })
    .filter((entry) => !entry.candidate.withdrawnOn)
    .sort(
      (a, b) =>
        candidates.indexOf(a.candidate) - candidates.indexOf(b.candidate) ||
        a.version.snapshot.title.localeCompare(b.version.snapshot.title, 'fr'),
    );
  const entries = relatedEntries.filter(
    ({ relation }) => relation.qualification === 'reponse',
  );
  const complements = relatedEntries.filter(
    ({ relation }) => relation.qualification === 'complement',
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
    complements,
    relations: relatedEntries.map(({ relation }) => relation),
    candidateIds,
    reviews,
    coverage,
    alerts,
    href,
  };
});
if (new Set(questions.map((q) => q.id)).size !== questions.length)
  throw new Error('Identifiant de question dupliqué');
export function questionsForMeasure(id: string) {
  return questions.filter((q) =>
    [...q.entries, ...q.complements].some((e) => e.measure.id === id),
  );
}
