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
      candidate: 'melenchon',
      sourceId: 'lfi-plan-sante-detail-2027',
      checked: '2026-11-26',
      locator:
        'Plan santé, section 3.2.14. Le passage insiste sur la confidentialité et les risques de dépendance des services. Il ne donne pas de nouvelle exigence pour les hébergeurs.',
    },
    {
      candidate: 'retailleau',
      sourceId: 'retailleau-vauban-numerique',
      checked: '2026-11-22',
      locator:
        'La fiche Vauban traite de la sécurité des hôpitaux et des hébergements sensibles, sans préciser une nouvelle règle pour les hébergeurs de données de santé.',
    },
    {
      candidate: 'philippe',
      sourceId: 'philippe-sante-2026',
      checked: '2026-11-26',
      locator:
        'Le programme prévoit un assistant médical hébergé en France. La réponse porte sur cet outil et ne détaille pas les règles pour les hébergeurs de données de santé.',
    },
  ],
  'fiscalite-csg-salaires': [
    {
      candidate: 'lepen',
      sourceId: 'lepen-plan-redressement-budgetaire-2026',
      checked: '2026-11-27',
      locator:
        'Présentation de la trajectoire du 6 octobre, passages sur les baisses de prélèvements. Aucun taux de CSG sur les revenus du travail n’y est donné.',
    },
    {
      candidate: 'philippe',
      sourceId: 'philippe-travail',
      checked: '2026-11-27',
      locator:
        'Volet travail et salaires. Les passages sur le salaire net et les heures travaillées décrivent notamment des exonérations de cotisations. Le taux de CSG sur les revenus du travail n’est pas précisé.',
    },
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
      candidate: 'lisnard',
      sourceId: 'lisnard-entretien-logement-2025',
      checked: '2026-11-26',
      locator:
        'Entretien sur le logement. Le passage préconise de revoir la loi Alur et la fiscalité locative, sans indiquer le sort des plafonds de loyers.',
    },
    {
      candidate: 'lepen',
      sourceId: 'rn-lettre-logement-2026',
      checked: '2026-11-20',
      locator:
        'Lettre ouverte du 21 septembre aux professionnels de l’immobilier. Elle traite notamment de la construction, du logement social, de la rénovation et de l’accès à la propriété.',
    },
  ],
  'statuts-outre-mer': [
    {
      candidate: 'lepen',
      sourceId: 'rn-rouge-forum-outre-mer-2026',
      checked: '2026-11-27',
      locator:
        'Réponse au MEDEF de Nouvelle-Calédonie. André Rougé, mandaté par Marine Le Pen, donne la priorité aux mesures économiques et sociales. Aucun processus de choix du statut n’est détaillé dans ce passage.',
    },
    {
      candidate: 'glucksmann',
      sourceId: 'place-publique-acte-i-pdf-officiel',
      checked: '2026-11-26',
      locator:
        'Acte I, chantier 33, passage sur la Nouvelle-Calédonie. Le mouvement prévoit une reprise du dialogue dans l’esprit de l’accord de Nouméa, sans procédure de choix du statut.',
    },
    {
      candidate: 'philippe',
      sourceId: 'philippe-programme-13',
      checked: '2026-11-26',
      locator:
        'Volet outre-mer. Le chapitre détaille notamment les mesures pour Mayotte et les moyens maritimes. Il ne prévoit pas de procédure de choix du statut des territoires.',
    },
  ],
  'retraites-regimes-particuliers': [
    {
      candidate: 'lepen',
      sourceId: 'lepen-retraites-document-24-novembre',
      checked: '2026-11-26',
      locator:
        'Présentation du 24 novembre, répartition et capitalisation. Le document précise le dispositif carrières longues et plusieurs règles de cotisation. Il ne détaille pas le sort des régimes spéciaux.',
    },
    {
      candidate: 'philippe',
      sourceId: 'philippe-pension',
      checked: '2026-11-26',
      locator:
        'Volet retraites. Les conditions de départ selon les métiers et le pilier de capitalisation sont détaillés. Le document ne précise pas la transition des régimes spéciaux.',
    },
    {
      candidate: 'glucksmann',
      sourceId: 'place-publique-acte-i-pdf-officiel',
      checked: '2026-11-26',
      locator:
        'Acte I, chantier 25 sur la protection sociale, page 53 du PDF. Le texte prévoit une convergence des régimes de Sécurité sociale et la prise en compte des spécificités professionnelles. Il ne détaille pas les régimes spéciaux de retraite.',
    },
  ],
  'retraites-penibilite': [
    {
      candidate: 'lepen',
      sourceId: 'lepen-retraites-document-24-novembre',
      checked: '2026-11-27',
      locator:
        'Présentation du régime par répartition. Le passage critique la complexité des critères de pénibilité et maintient les carrières longues lorsqu’elles sont plus favorables. Il ne définit pas de nouvel âge de départ selon la pénibilité.',
    },
    {
      candidate: 'melenchon',
      sourceId: 'lfi-plan-sante-detail-2027',
      checked: '2026-11-27',
      locator:
        'Section 2.6 sur la santé au travail. Elle énumère des expositions et contraintes dont les droits à la retraite tiendraient compte. Aucun âge réduit ni barème de départ anticipé n’est fixé dans cette section.',
    },
  ],
  'logement-obligations-parc-social': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-programme-12',
      checked: '2026-11-26',
      locator:
        'Volet logement, réponse sur les pouvoirs des maires. Il prévoit de leur confier les attributions de logements sociaux. Le passage ne fixe pas les obligations de construction des communes.',
    },
  ],
  'regroupement-familial': [
    {
      candidate: 'glucksmann',
      sourceId: 'place-publique-acte-i-pdf-officiel',
      checked: '2026-11-26',
      locator:
        'Acte I, chantier sur la politique migratoire, accueil, voies légales et séjour. Le passage ne fixe pas de conditions propres au regroupement familial.',
    },
    {
      candidate: 'melenchon',
      sourceId: 'melenchon-programme-14',
      checked: '2026-11-26',
      locator:
        'Chapitre sur les discriminations et l’immigration. Les conditions de séjour et de régularisation y figurent. Le texte ne précise pas de règle de regroupement familial.',
    },
  ],
  'education-eleves-par-classe': [
    {
      candidate: 'lisnard',
      sourceId: 'lisnard-ecole',
      checked: '2026-11-26',
      locator:
        'Volet éducation, passages sur l’autonomie des écoles et les classes d’excellence. Ce document ne fixe pas de nombre maximal d’élèves par classe.',
    },
  ],
  'numerique-publicite': [
    {
      candidate: 'melenchon',
      sourceId: 'lfi-numerique',
      checked: '2026-11-26',
      locator:
        'Chapitre 7, lutte contre la collecte abusive et les fuites de données. Le traitement des données personnelles est abordé sans régime spécial pour le ciblage publicitaire.',
    },
  ],
  'numerique-recommandations': [
    {
      candidate: 'melenchon',
      sourceId: 'lfi-numerique',
      checked: '2026-11-26',
      locator:
        'Chapitre 7, passages sur les grandes plateformes, la modération et l’intelligence artificielle. Les modalités de classement des fils de recommandation ne sont pas précisées.',
    },
  ],
  'numerique-cloud-sensible': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-ia',
      checked: '2026-11-26',
      locator:
        'Volet intelligence artificielle. Il propose des capacités européennes de calcul et d’infrastructure sans préciser de qualification pour le cloud sensible de l’État.',
    },
  ],
  'climat-prix-energie': [
    {
      candidate: 'lisnard',
      sourceId: 'lisnard-entretien-ecologie-2026',
      checked: '2026-11-27',
      locator:
        'Section sur le nucléaire et l’hydroélectricité. Elle vise une production compétitive et une évaluation du coût des investissements. Aucun tarif ni dispositif sur la facture n’est précisé.',
    },
  ],
  'climat-avenir-eolien': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-programme-5',
      checked: '2026-11-27',
      locator:
        'Volet énergie, réponse sur les renouvelables. Le candidat prévoit leur développement aux côtés du nucléaire. Aucun projet de parc éolien ni objectif propre à cette filière n’y figure.',
    },
  ],
  'handicap-accompagnement-ecole': [
    {
      candidate: 'lisnard',
      sourceId: 'lisnard-entretien-destinee-education',
      checked: '2026-11-27',
      locator:
        'Section sur l’inclusion scolaire. Le compte rendu propose de développer les ULIS. Il ne détaille ni les contrats ni le statut des accompagnants.',
    },
  ],
  'travail-demarches-entreprises': [
    {
      candidate: 'glucksmann',
      sourceId: 'place-publique-acte-i-pdf-officiel',
      checked: '2026-11-27',
      locator:
        'Acte I, chantier 17, page 41 du PDF. Place publique prévoit des accompagnements ciblés pour certaines TPE et PME. Le passage ne désigne pas de formalité administrative à simplifier.',
    },
  ],
  'institutions-contributions-citoyennes': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-programme-5',
      checked: '2026-11-27',
      locator:
        'Formulaire de contribution en fin de volet énergie. La campagne sollicite des avis et prévoit une synthèse. Ce formulaire ne décrit pas un droit d’initiative ouvert aux citoyens après l’élection.',
    },
  ],
  'numerique-compagnons-ia': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-ia',
      checked: '2026-11-27',
      locator:
        'Réponse sur la protection des enfants. Elle porte sur les contenus illicites générés par IA et la responsabilité des plateformes. Les agents conversationnels destinés aux mineurs n’y sont pas traités.',
    },
  ],
  'numerique-decisions-automatisees': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-ia',
      checked: '2026-11-27',
      locator:
        'Réponse sur l’utilisation de l’IA par l’État. Le volet porte sur le traitement de démarches simples. Les garanties de recours à l’encontre des décisions individuelles automatisées ne sont pas précisées.',
    },
  ],
  'numerique-demarches-en-ligne': [
    {
      candidate: 'glucksmann',
      sourceId: 'place-publique-acte-i-pdf-officiel',
      checked: '2026-11-27',
      locator:
        'Acte I, chantier 25, page 53 du PDF. Le dossier social unique est destiné à ouvrir automatiquement des droits. Les guichets décrits sont physiques. Le passage ne définit pas de service de dépôt en ligne.',
    },
    {
      candidate: 'philippe',
      sourceId: 'philippe-ia',
      checked: '2026-11-27',
      locator:
        'Le volet prévoit le traitement de démarches simples à l’aide de l’IA. Il ne précise pas le guichet numérique par lequel les usagers déposeraient leurs demandes.',
    },
  ],
  'numerique-reversibilite-cloud': [
    {
      candidate: 'philippe',
      sourceId: 'philippe-ia',
      checked: '2026-11-27',
      locator:
        'Pacte européen de puissance numérique, infrastructures et zones d’accélération. Le traitement des contrats de sortie et de la migration entre hébergeurs reste à préciser.',
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
  'climat-eau-potable':
    'Comment garantir l’accès à l’eau potable et rénover les réseaux ?',
  'fiscalite-csg-salaires':
    'Faut-il baisser ou supprimer la CSG sur les revenus du travail ?',
};
const additions = [
  {
    id: 'fiscalite-epargne',
    theme: 'fiscalite',
    title: 'Quelle fiscalité et quelles garanties pour l’épargne des ménages ?',
    terms: 'fiscalité de l’épargne ponction sur l’épargne assurance vie',
    versions: [
      'attal-nov28-fiscalite-assurance-vie-stable-v1',
      'attal-nov28-preserver-epargne-des-francais-v1',
    ],
  },
  {
    id: 'fiscalite-depenses-publiques',
    theme: 'fiscalite',
    title: 'Comment répartir l’effort de réduction des dépenses publiques ?',
    terms:
      'économies budgétaires baisse des dépenses publiques budgets ministériels dépenses des collectivités',
    versions: [
      'attal-nov28-sanctuariser-budgets-regaliens-v1',
      'philippe-nov28-exiger-de-letat-et-des-collectivites-un-quart-de-leffort-de-redressement-an-v1',
    ],
  },
  {
    id: 'education-orientation-metiers',
    theme: 'education',
    title:
      'Comment préparer l’orientation des élèves et leur entrée dans la vie active ?',
    terms:
      'orientation scolaire découverte des métiers lycée professionnel insertion des jeunes',
    versions: [
      'attal-nov28-entrer-plus-tot-vie-active-v1',
      'attal-nov28-contrat-entreprise-lyceen-professionnel-v1',
      'attal-nov28-parcours-orientation-eleves-v1',
    ],
  },
  {
    id: 'securite-justice-mineurs',
    theme: 'securite',
    title:
      'Quelles règles appliquer aux mineurs et aux parents dans la justice pénale ?',
    terms: 'justice des mineurs excuse de minorité responsabilité des parents',
    versions: [
      'attal-nov28-excuse-de-minorite-attenuee-v1',
      'attal-nov28-responsabilite-deux-parents-mineurs-v1',
      'lisnard-excuse-minorite-attenuation-20-v1',
      'lisnard-etablissements-disciplinaires-jeunes-delinquants-v1',
      'retailleau-courtes-peines-premier-delit-grave-mineurs-v1',
    ],
  },
  {
    id: 'securite-occupation-sans-droit',
    theme: 'securite',
    title: 'Comment traiter les occupations illégales de terrains ?',
    terms:
      'occupation de terrain évacuation de terrain gens du voyage convoi de caravanes',
    versions: [
      'attal-nov28-juge-statue-sous-quarante-huit-heures-v1',
      'attal-nov28-registre-national-grands-convois-v1',
      'attal-nov28-renforts-zones-grand-passage-v1',
    ],
  },
  {
    id: 'climat-matieres-premieres-recyclage',
    theme: 'climat',
    title: 'Comment réduire la dépendance aux matières premières critiques ?',
    terms:
      'matières premières critiques lithium recyclage des métaux raffinage des terres rares',
    versions: [
      'attal-nov28-premiere-economie-circulaire-v1',
      'attal-nov28-lithium-massif-central-alsace-v1',
      'lepen-diversifier-approvisionnements-metaux-critiques-v1',
    ],
  },
  {
    id: 'climat-ressource-en-eau',
    theme: 'climat',
    title: 'Comment gérer la ressource en eau face à la sécheresse ?',
    terms:
      'restriction d’eau sécheresse stockage de l’eau réserve d’eau agricole',
    versions: [
      'attal-nov28-sanctions-alertes-secheresse-v1',
      'lisnard-entretien-ouvrages-seuils-vannes-v1',
      'lisnard-accelerer-autorisations-retenues-agricoles-v1',
    ],
  },
  {
    id: 'education-evaluation-diplomes',
    theme: 'education',
    title: 'Comment organiser l’évaluation et les examens nationaux ?',
    terms: 'baccalauréat épreuves terminales contrôle continu examen national',
    versions: ['attal-nov28-epreuves-terminales-bac-v1'],
  },
  {
    id: 'travail-sante-securite',
    theme: 'travail',
    title: 'Comment prévenir les accidents du travail ?',
    terms: 'accident du travail sécurité des salariés risques professionnels',
    versions: ['attal-nov28-diviser-par-deux-accidents-du-travail-v1'],
  },
  {
    id: 'sante-infertilite',
    theme: 'sante',
    title: 'Que proposent les candidats au sujet de l’infertilité ?',
    terms: 'infertilité fertilité santé reproductive',
    versions: ['attal-nov28-infertilite-au-coeur-du-debat-v1'],
  },
  {
    id: 'logement-premier-achat',
    theme: 'logement',
    title: 'Comment faciliter l’achat d’un premier logement ?',
    terms:
      'accès à la propriété premier achat crédit immobilier primo-accédant',
    versions: [
      'attal-lci-revoir-la-maniere-dont-les-banques-evaluent-la-capacite-demprunt-immobilier-v1',
      'retailleau-etendre-ptz-primo-accedants-sans-zonage-v1',
    ],
  },
  {
    id: 'sante-sante-mentale',
    theme: 'sante',
    title: 'Comment garantir l’accès des jeunes aux soins de santé mentale ?',
    terms:
      'santé mentale des jeunes entretien psychologique consultation psychologique bilan psychologique',
    versions: [
      'renaissance-pouvoir-consulter-un-professionnel-de-sante-mentale-deux-fois-avant-ses-18-v1',
    ],
  },
  {
    id: 'securite-violences-sexistes',
    theme: 'securite',
    title:
      'Comment combattre les violences sexistes et sexuelles et accompagner les victimes ?',
    terms:
      'violences sexistes violences sexuelles victimes de violences dépôt de plainte',
    versions: [
      'renaissance-preparer-une-loi-cadre-contre-les-violences-sexistes-et-sexuelles-v1',
      'renaissance-creer-des-centres-daccueil-permanent-pour-les-victimes-de-violences-sexuell-v1',
      'renaissance-donner-acces-a-un-avocat-de-permanence-des-le-depot-de-plainte-pour-certain-v1',
      'renaissance-informer-systematiquement-les-victimes-avant-la-liberation-de-lauteur-de-vi-v1',
    ],
  },
  {
    id: 'securite-reinsertion-prison',
    theme: 'securite',
    title: 'Comment préparer la réinsertion et prévenir la récidive ?',
    terms:
      'réinsertion récidive formation des détenus sortie de prison justice restaurative',
    versions: [
      'renaissance-developper-les-centres-de-formation-dapprentis-adosses-aux-prisons-v1',
      'renaissance-accompagner-les-detenus-trois-a-six-mois-avant-leur-liberation-v1',
      'renaissance-developper-la-justice-restaurative-v1',
    ],
  },
  {
    id: 'securite-cybercriminalite',
    theme: 'numerique',
    title: 'Comment organiser la lutte judiciaire contre la cybercriminalité ?',
    terms:
      'cybercriminalité parquet cyber justice numérique poursuivre les cyberdélits',
    versions: [
      'renaissance-transformer-la-section-judiciaire-specialisee-j3-en-parquet-national-cyber-v1',
    ],
  },
  {
    id: 'education-universites',
    theme: 'education',
    title:
      'Quelles règles pour la gouvernance et le contrôle des établissements du supérieur ?',
    terms:
      'autonomie universitaire enseignement supérieur privé contrat des universités accréditation de formations',
    versions: [
      'renaissance-renforcer-le-controle-des-formations-privees-lucratives-de-lenseignement-su-v1',
      'renaissance-renforcer-lautonomie-universitaire-avec-des-contrats-de-financement-de-cinq-v1',
    ],
  },
  {
    id: 'education-recherche',
    theme: 'education',
    title: 'Comment organiser et financer la recherche publique ?',
    terms:
      'recherche publique laboratoire universitaire agence nationale de la recherche financement de la recherche',
    versions: [
      'renaissance-confier-la-gestion-des-laboratoires-universitaires-aux-universites-dimplant-v1',
      'renaissance-financer-les-petits-projets-de-recherche-directement-par-les-universites-ou-v1',
      'renaissance-autoriser-les-chercheurs-a-utiliser-les-ressources-universitaires-en-echang-v1',
    ],
  },
  {
    id: 'numerique-regulation-ia',
    theme: 'numerique',
    title:
      'Comment réglementer l’intelligence artificielle en Europe et dans le monde ?',
    terms:
      'régulation de l’IA réglementation de l’intelligence artificielle cadre européen de l’IA règles internationales de l’IA',
    versions: [
      'philippe-nov28-simplifier-le-cadre-juridique-europeen-de-lia-v1',
      'philippe-nov28-negocier-une-regulation-internationale-de-lintelligence-artificielle-v1',
    ],
  },
  {
    id: 'fiscalite-credit-emploi-a-domicile',
    theme: 'fiscalite',
    title:
      'Quel crédit d’impôt pour l’emploi à domicile et les services à la personne ?',
    terms:
      'crédit d’impôt à domicile services à la personne salarié à domicile avance immédiate',
    versions: [
      'retailleau-maintenir-credit-impot-domicile-cinq-ans-v1',
      'polony-credit-impot-domicile-taux-modules-v2',
      'philippe-nov28-maintenir-a-50-le-credit-dimpot-pour-lemploi-dun-salarie-a-domicile-v1',
    ],
  },
  {
    id: 'climat-renovation-batiments-publics',
    theme: 'climat',
    title: 'Comment rénover et adapter les bâtiments publics et tertiaires ?',
    terms:
      'rénovation thermique des bâtiments publics performance énergétique du tertiaire',
    versions: [
      'melenchon-soutien-renovation-tertiaire-tpe-pme-v1',
      'melenchon-renovation-canicule-ecoles-ehpad-hopitaux-v1',
    ],
  },
  {
    id: 'travail-formation-professionnelle',
    theme: 'travail',
    title:
      'Comment former aux nouveaux métiers et soutenir les reconversions ?',
    terms:
      'formation professionnelle reconversion professionnelle formation des salariés',
    versions: [
      'melenchon-former-250-mille-renovation-bas-carbone-v1',
      'melenchon-10-millions-constructeurs-formation-automobile-v1',
      'melenchon-diplomes-filiere-polytechnique-automobile-v1',
      'melenchon-plan-formation-bts-metiers-textile-v1',
      'place-publique-former-techniciens-reparation-objets-v1',
      'lisnard-reformer-acces-financements-formation-v1',
      'retailleau-apprentissage-des-quatorze-ans-v1',
      'retailleau-adapter-contenu-local-formation-branches-v1',
      'retailleau-suramortir-equipements-lycees-professionnels-v1',
    ],
  },
  {
    id: 'climat-mobilite-electrique',
    theme: 'climat',
    title: 'Comment développer la mobilité électrique ?',
    terms: 'voitures électriques véhicules électriques mobilité électrique',
    versions: [
      'melenchon-conversion-vehicules-electriques-2-millions-v1',
      'melenchon-categorie-europeenne-petits-vehicules-36m-v1',
      'melenchon-flottes-entreprises-achats-electriques-90-v1',
      'melenchon-service-public-location-vehicules-14-million-v1',
      'melenchon-bonus-voitures-electriques-moins-30-mille-v1',
      'melenchon-bornes-de-recharge-logements-collectifs-v1',
      'place-publique-flottes-entreprises-collectivites-electriques-v1',
    ],
  },
  {
    id: 'travail-conges-payes-calendrier',
    theme: 'travail',
    title: 'Qui fixerait le calendrier des congés payés ?',
    terms: 'calendrier des congés payés congé principal',
    versions: ['lisnard-liberer-calendrier-conge-principal-v1'],
  },
  {
    id: 'sante-industrie-produits-medicaux',
    theme: 'sante',
    title: 'Quelles règles pour les dispositifs médicaux et les laboratoires ?',
    terms:
      'homologation des dispositifs médicaux accréditation des laboratoires',
    versions: [
      'lisnard-allegements-homologation-dispositifs-v1',
      'lisnard-encadrer-accreditation-laboratoires-v1',
    ],
  },
  {
    id: 'sante-urgences',
    theme: 'sante',
    title: 'Comment organiser les secours et les urgences ?',
    terms: 'SAMU secours d’urgence services d’incendie et de secours',
    versions: ['lisnard-clarifier-repartition-samu-sdis-v1'],
  },
  {
    id: 'retraites-pension-de-reversion',
    theme: 'retraites',
    title: 'Quelles règles pour la pension de réversion ?',
    terms: 'pension de réversion pensions de réversion',
    versions: ['lisnard-supprimer-certificat-annuel-non-remariage-v1'],
  },
  {
    id: 'institutions-normes-evaluation',
    theme: 'institutions',
    title: 'Comment réviser et évaluer les normes ?',
    terms:
      'simplification des normes évaluation des normes règles contradictoires',
    versions: [
      'lisnard-rescrit-normes-contradictoires-v1',
      'lisnard-controle-pme-veto-contradictions-normes-v1',
      'lisnard-rapport-annuel-regles-contradictoires-v1',
      'lisnard-recours-juger-utilite-norme-v1',
      'lisnard-mesurer-effet-nouvelles-normes-croissance-v1',
    ],
  },
  {
    id: 'retraites-cumul-emploi',
    theme: 'retraites',
    title: 'Comment cumuler un emploi et une pension de retraite ?',
    terms: 'cumul emploi retraite retraités qui travaillent',
    versions: ['retailleau-unifier-cumul-et-surcharge-apres-age-legal-v1'],
  },
  {
    id: 'sante-expositions-environnementales',
    theme: 'sante',
    title: 'Comment prendre en charge les personnes exposées à des polluants ?',
    terms:
      'chlordécone exposition à des polluants indemnisation environnementale',
    versions: ['lepen-outremer-indemniser-chlordecone-v1'],
  },
  {
    id: 'travail-indemnisation-chomage',
    theme: 'travail',
    title:
      'Qui devrait être indemnisé au chômage, à quel niveau et pendant combien de temps ?',
    terms:
      'assurance-chômage durée d’indemnisation allocation chômage rupture conventionnelle dégressivité',
    versions: [
      'zemmour-chomage-indemnisation-un-an-v1',
      'zemmour-chomage-trois-mois-travail-un-mois-indemnisation-v1',
      'zemmour-chomage-exclure-ruptures-conventionnelles-v1',
    ],
  },
  {
    id: 'fiscalite-accises-tabac',
    theme: 'fiscalite',
    title: 'Comment taxer le tabac et encadrer l’évolution des prix ?',
    terms:
      'prix du tabac accise sur le tabac taxe sur le tabac indexation du tabac',
    versions: ['lepen-geler-prix-tabac-desindexer-v1'],
  },
  {
    id: 'logement-protection-contre-squats',
    theme: 'logement',
    title: 'Comment traiter les occupations sans droit d’un logement ?',
    terms:
      'squat occupation de logement droit de propriété expulsion de squatteurs',
    versions: ['zemmour-renforcer-reponse-squats-v1'],
  },
  {
    id: 'europe-politique-monetaire',
    theme: 'europe',
    title: 'Quel rôle pour la BCE dans le financement de l’économie ?',
    terms:
      'Banque centrale européenne BCE taux favorable investissements d’avenir',
    versions: ['lepen-bce-investissements-taux-favorables-v1'],
  },
  {
    id: 'education-financement-des-etudes',
    theme: 'education',
    title: 'Comment financer les études supérieures et la formation ?',
    terms:
      'études étudiants rémunération étudiants bourses universités recherche formation',
    versions: ['dubuisson-formation-remuneree-etudiants-v1'],
  },
  {
    id: 'travail-conges-evenements-familiaux',
    theme: 'travail',
    title: 'Quels congés accorder aux salariés lors d’un événement familial ?',
    terms:
      'congés salariés événements famille congé paternité décès bien-être animal',
    versions: [
      'billetdoux-conge-paternite-v2',
      'markovic-conge-perte-animal-identifie-v1',
    ],
  },
  {
    id: 'institutions-symboles-republique',
    theme: 'institutions',
    title: 'Quels symboles et quelle devise pour le régime politique ?',
    terms: 'symboles république dénomination devise régime républicain',
    versions: [
      'pic-democratie-francaise-v1',
      'tinland-changer-devise-republique-citoyenne-v1',
    ],
  },
  {
    id: 'institutions-dialogue-executif-citoyens',
    theme: 'institutions',
    title: 'Comment les citoyens pourraient-ils dialoguer avec l’exécutif ?',
    terms:
      'questions citoyens accessibilité dialogue exécutif ministères président',
    versions: [
      'delmur-contact-ministeres-citoyens-v1',
      'asselineau-questions-francais-president-direct-mensuel-v1',
    ],
  },

  {
    id: 'climat-mobilite-collective',
    theme: 'climat',
    title: 'Comment développer les transports collectifs ?',
    terms: 'mobilité transports en commun train bus réseau déplacements',
    versions: [
      'delmur-transports-zones-mal-desservies-v1',
      'markovic-transport-public-gratuit-chiens-chats-v1',
      'rohou-stationnements-peripherie-gratuits-v1',
      'dubuisson-ferroutage-hubs-multimodaux-v1',
    ],
  },
  {
    id: 'climat-agriculture-ecologie',
    theme: 'climat',
    title: 'Quelles règles environnementales pour l’agriculture ?',
    terms: 'pesticides eau cultures irrigation phytosanitaires',
    versions: [
      'markovic-pesticides-perimetre-zones-habitees-v1',
      'markovic-aides-agricoles-sans-pesticides-v1',
      'rohou-interdire-pesticides-doute-serieux-v1',
      'collovati-dessalement-irrigation-v1',
      'dubuisson-developper-haies-adapter-cultures-v1',
    ],
  },
  {
    id: 'climat-pilotage-transition',
    theme: 'climat',
    title: 'Comment financer et organiser la transition écologique ?',
    terms: 'transition climatique financement moyens industriels planification',
    versions: [
      'kazib-planifier-democratiquement-production-besoins-environnement-v1',
      'collovati-suppression-ademe-v1',
      'herlin-subventions-decarbonation-industrie-v1',
      'herlin-voiture-thermique-europe-2035-v1',
    ],
  },
  {
    id: 'climat-risques-naturels',
    theme: 'climat',
    title: 'Comment prévenir les risques naturels et protéger les ressources ?',
    terms: 'incendies feux sécheresse prévention eau gaspillage risques',
    versions: [
      'collovati-reducteurs-debit-batiments-v1',
      'collovati-canadair-production-v1',
      'dubuisson-urbanisme-bioclimatique-v1',
    ],
  },
  {
    id: 'climat-protection-biodiversite',
    theme: 'climat',
    title: 'Comment protéger la biodiversité et encadrer la chasse ?',
    terms: 'chasse faune faune sauvage biodiversité habitats espèces',
    versions: [
      'delmur-permis-chasse-controles-v1',
      'markovic-gibier-elevage-importation-exportation-v1',
      'markovic-centre-soins-faune-departement-v1',
      'markovic-libre-evolution-terres-2030-v1',
      'markovic-foret-obligation-reelle-compensation-v1',
      'markovic-libre-evolution-mer-2030-v1',
      'markovic-clotures-passage-petits-animaux-v1',
      'markovic-prevenir-collisions-vehicules-animaux-v1',
      'markovic-autorite-fonds-degats-cultures-v1',
      'markovic-cartographier-degats-ongules-v1',
      'markovic-indemnisation-degats-prevention-v1',
      'markovic-berges-urbaines-reservees-faune-v1',
      'markovic-limiter-nuisances-activites-mer-v1',
      'markovic-trophees-chasse-exotique-v1',
      'tinland-sanctuaire-biodiversite-tiers-territoire-v1',
    ],
  },
  {
    id: 'climat-condition-animale',
    theme: 'climat',
    title: 'Comment protéger les animaux dans les activités humaines ?',
    terms:
      'animaux protection animale captivité pêche loisirs animaux de compagnie',
    versions: [
      'delmur-maltraitance-animale-amende-extreme-v1',
      'delmur-abandon-animal-nouvelle-adoption-v1',
      'delmur-refuges-adoption-v1',
      'delmur-controle-elevages-compagnie-v1',
      'delmur-animaux-compagnie-especes-interdites-v1',
      'delmur-oiseaux-cage-v1',
      'delmur-adoption-visite-domicile-v1',
      'delmur-volume-aquarium-v1',
      'delmur-poissons-fetes-foraines-v1',
      'markovic-statut-resident-animaux-compagnie-periurbains-v1',
      'markovic-fourrure-production-importation-vente-v1',
      'markovic-hebergement-animaux-saisis-v1',
      'markovic-interdiction-abattage-chevaux-v1',
      'markovic-tarif-identification-compagnie-v1',
      'markovic-controle-identification-animaux-v1',
      'markovic-tracabilite-elevages-chats-chiens-v1',
      'markovic-liste-dressage-compagnie-interdits-v1',
      'markovic-plan-trafic-animaux-compagnie-v1',
      'markovic-volume-minimum-aquariums-v1',
      'markovic-chiens-travail-protection-v1',
      'markovic-chiens-travail-fonds-retraite-v1',
      'markovic-hypertypes-compagnie-encadrement-v1',
      'markovic-observatoire-morsures-chien-v1',
      'markovic-permis-detention-tous-chiens-v1',
      'markovic-mutuelle-animaux-appel-offres-v1',
      'markovic-prise-en-charge-soins-animaux-menages-modestes-v1',
      'markovic-pigeonniers-contraceptifs-v1',
      'markovic-reconversion-zoos-aquariums-sanctuaires-v1',
      'markovic-interdire-courses-hippiques-v1',
      'markovic-fonds-retraite-chevaux-v1',
      'collovati-animaux-maltraitance-reparation-v1',
    ],
  },
  {
    id: 'climat-politique-agricole',
    theme: 'climat',
    title: 'Comment orienter la politique agricole ?',
    terms:
      'production terres alimentation agriculteurs politique agricole commune',
    versions: [
      'delmur-consultation-agriculteurs-v1',
      'markovic-pret-taux-zero-agriculture-vegetale-v1',
      'markovic-subventions-publicite-produits-animaux-v1',
      'markovic-denominations-produits-vegetaux-v1',
      'markovic-semences-libre-choix-v1',
      'markovic-dja-conventions-bien-etre-environnement-v1',
      'tinland-aider-agriculture-vivriere-domestique-v1',
      'rohou-interdire-cultures-ogm-v1',
      'legendre-circuits-courts-v1',
      'dubuisson-transformer-produits-agricoles-localement-v1',
    ],
  },
  {
    id: 'education-enseignements',
    theme: 'education',
    title: 'Quels enseignements et quel accompagnement proposer à l’école ?',
    terms:
      'programmes scolaires apprentissage soutien élèves disciplines examens',
    versions: [
      'delmur-accompagnement-eleves-difficulte-v1',
      'markovic-ethologie-programmes-scolaires-v1',
      'markovic-neutralite-interets-prives-chasse-ecole-v1',
      'markovic-dissections-ecole-v1',
      'markovic-cuisine-vegetale-formation-v1',
      'markovic-enseignement-institutions-examens-v1',
      'rohou-internats-finances-etat-jeunes-difficulte-v1',
      'rohou-initiation-philosophes-ecole-v1',
      'polony-soutenir-une-dictee-quotidienne-avec-enseignants-formes-v1',
      'collovati-ecole-personnalites-hommage-v1',
      'herlin-enseignement-fondamentaux-autorite-v1',
      'legendre-associer-enseignants-reforme-v1',
      'dubuisson-formation-enseignants-filieres-v1',
    ],
  },
  {
    id: 'education-vie-scolaire',
    theme: 'education',
    title:
      'Quelles règles de vie et quels moyens dans les établissements scolaires ?',
    terms: 'discipline sanctions absentéisme harcèlement moyens école classes',
    versions: [
      'polony-se-dire-plutot-favorable-a-uniforme-scolaire-v1',
      'asselineau-organiser-echanges-eleves-outremer-hexagone-v1',
      'bouamrane-augmenter-effectifs-enseignants-v1',
      'collovati-retenues-samedi-v1',
      'herlin-autonomie-etablissements-publics-v1',
    ],
  },
  {
    id: 'education-sport',
    theme: 'education',
    title: 'Quelle place donner au sport chez les jeunes ?',
    terms: 'sport pratiques sportives éducation physique fédérations jeunes',
    versions: [
      'delmur-equipements-sportifs-proximite-v1',
      'collovati-sport-secondaire-v1',
    ],
  },
  {
    id: 'education-arts-et-culture',
    theme: 'education',
    title: 'Comment soutenir la culture et l’accès aux œuvres ?',
    terms: 'culture spectacles artistes culture patrimoine création',
    versions: [
      'delmur-patrimoine-savoir-faire-v1',
      'delmur-production-cinema-francais-v1',
      'delmur-culture-territoires-ruraux-populaires-v1',
      'rohou-acces-jardins-familiaux-maisons-nature-v1',
    ],
  },
  {
    id: 'europe-defense-moyens',
    theme: 'europe',
    title: 'Quelles capacités pour la défense française ?',
    terms:
      'forces armées défense militaire armement équipements dissuasion nucléaire',
    versions: [
      'delmur-modernisation-flotte-aerienne-militaire-v1',
      'delmur-modernisation-flotte-navale-v1',
      'rohou-defense-europeenne-autonome-v1',
      'collovati-programmes-drones-defense-v1',
      'herlin-adapter-dissuasion-missiles-hypersoniques-v1',
      'herlin-annuler-dissuasion-avancee-v1',
      'dubuisson-developper-capacites-defense-v1',
      'marchal-donner-priorite-nucleaire-militaire-v1',
    ],
  },
  {
    id: 'europe-solidarite-internationale',
    theme: 'europe',
    title: 'Quels engagements internationaux et quelle aide au développement ?',
    terms:
      'coopération internationale aide publique développement aide extérieure diplomatie',
    versions: [
      'markovic-diplomatie-chasse-cetaces-v1',
      'tinland-mediation-diplomatique-conflits-v1',
      'rohou-onu-siege-oslo-revoir-veto-v1',
      'rohou-competence-internationale-delits-ecologiques-v1',
      'kazib-soutenir-autodetermination-peuples-palestine-kanaky-v1',
      'asselineau-reexaminer-aide-publique-developpement-v1',
      'collovati-remettre-en-cause-afd-v1',
    ],
  },
  {
    id: 'europe-negociation-ukraine',
    theme: 'europe',
    title: 'Quelle action diplomatique en réponse à la guerre en Ukraine ?',
    terms: 'Ukraine Russie négociations cessez-le-feu paix diplomatie',
    versions: [
      'riner-discuter-ukraine-russie-fin-guerre-v1',
      'herlin-ukraine-russie-relations-v1',
    ],
  },
  {
    id: 'fiscalite-commerce',
    theme: 'fiscalite',
    title: 'Quelles taxes ou règles appliquer aux produits importés ?',
    terms:
      'douane droits de douane taxe importations achats étrangers protectionnisme',
    versions: [
      'delmur-prix-produits-etrangers-v1',
      'markovic-clauses-miroirs-bien-etre-animal-v1',
      'rohou-egalite-qualite-chimique-importations-v1',
      'pic-adherer-accord-omc-marches-publics-v1',
      'pic-publier-doctrine-contre-mesures-commerciales-v1',
      'arthaud-sopposer-protectionnisme-commercial-pour-emploi-v1',
      'collovati-taxer-commandes-exterieures-v1',
      'dubuisson-plateforme-marches-publics-export-v1',
    ],
  },
  {
    id: 'fiscalite-entreprises',
    theme: 'fiscalite',
    title: 'Comment taxer les entreprises et leurs bénéfices ?',
    terms:
      'impôts entreprises fiscalité société production bénéfices impôt sur les sociétés',
    versions: [
      'markovic-legs-dons-associations-protection-animale-v1',
      'markovic-credit-impot-benevolat-v1',
      'markovic-exonerations-entreprises-alternatives-vegetales-v1',
    ],
  },
  {
    id: 'fiscalite-controle-impot',
    theme: 'fiscalite',
    title: 'Comment lutter contre la fraude et l’évasion fiscales ?',
    terms: 'fraude fiscale évasion paradis fiscaux contrôle impôt',
    versions: [
      'roussel-recruter-agents-fraude-evasion-fiscales-v1',
      'delmur-fraude-fiscale-v1',
      'dubuisson-departement-conformite-bancaire-v1',
      'dubuisson-registre-beneficiaires-effectifs-v1',
    ],
  },
  {
    id: 'fiscalite-patrimoine-et-revenus',
    theme: 'fiscalite',
    title: 'Comment imposer les revenus et le patrimoine ?',
    terms: 'impôts revenus fortune patrimoine barème imposition capital ISF',
    versions: [
      'billetdoux-isf-climatique-v2',
      'markovic-quotient-familial-animaux-v1',
      'tinland-bareme-impot-revenu-universel-v1',
      'collovati-sans-retour-isf-v1',
    ],
  },
  {
    id: 'fiscalite-biens-et-credits-publics',
    theme: 'fiscalite',
    title: 'Quelles règles pour le patrimoine et les crédits publics ?',
    terms:
      'patrimoine public finances publiques budget cessions dépenses biens de l’État',
    versions: [
      'delmur-cession-batiments-penitentiaires-v1',
      'asselineau-negocier-reechelonnement-dette-apres-euro-v1',
      'asselineau-vendre-mobilier-elysee-mobilier-national-v1',
      'asselineau-reduire-flotte-aerienne-presidentielle-v1',
      'dubuisson-fonds-souverain-financement-v1',
      'dubuisson-regle-constitutionnelle-equilibre-v1',
    ],
  },
  {
    id: 'immigration-entree-sejour',
    theme: 'immigration',
    title: 'Quelles conditions pour entrer en France et y séjourner ?',
    terms: 'visas immigration titres de séjour admission asile frontières',
    versions: [
      'delmur-maintien-emploi-sejour-v1',
      'pic-loi-migratoire-triennale-et-plafonds-v1',
      'asselineau-negocier-aide-comores-surveillance-departs-mayotte-v1',
      'collovati-visas-hors-ue-v1',
      'herlin-frontieres-nationales-schengen-v1',
      'legendre-visas-etudiants-reciprocite-v1',
    ],
  },
  {
    id: 'immigration-eloignement',
    theme: 'immigration',
    title:
      'Comment organiser l’éloignement des personnes en situation irrégulière ?',
    terms: 'OQTF expulsion éloignement rétention séjour irrégulier',
    versions: [
      'delmur-prisonniers-etrangers-retour-v1',
      'polony-envisager-pays-tiers-pour-eloignement-sous-controle-v1',
      'collovati-expulsion-oqtf-v1',
      'collovati-hebergement-irregulier-v1',
      'herlin-remigration-casier-ressources-v1',
    ],
  },
  {
    id: 'immigration-nationalite',
    theme: 'immigration',
    title: 'Quelles règles pour acquérir, conserver ou perdre la nationalité ?',
    terms:
      'nationalité citoyenneté double nationalité déchéance naturalisation',
    versions: ['collovati-nationalite-double-decheance-v1'],
  },
  {
    id: 'institutions-mandat-et-remuneration',
    theme: 'institutions',
    title: 'Quels droits, obligations et rémunérations pour les élus ?',
    terms:
      'rémunération élus mandat indemnités président ministres parlementaires',
    versions: [
      'rohou-revenus-imposables-consultables-internet-v1',
      'revillon-apreval-saisie-patrimoine-apres-jugement-populaire-v1',
      'collovati-remuneration-president-v1',
      'collovati-indemnites-parlementaires-v1',
      'collovati-remuneration-gouvernement-v1',
    ],
  },
  {
    id: 'institutions-representation-publique',
    theme: 'institutions',
    title: 'Comment organiser la représentation politique et les assemblées ?',
    terms:
      'assemblée sénat députés représentation législatives scrutin conseil parlement',
    versions: [
      'pic-chambre-citoyenne-senat-v1',
      'markovic-vote-blanc-suffrage-exprime-v1',
      'markovic-proportionnelle-legislatives-v1',
      'tinland-scrutin-parlementaire-prime-majorite-v1',
      'rohou-equilibre-amendements-budgetaires-v1',
      'asselineau-ramener-senat-100-membres-v1',
      'asselineau-reduire-nombre-deputes-referendum-v1',
      'asselineau-diviser-par-deux-conseillers-departementaux-v1',
      'collovati-suppression-cese-ceser-v1',
      'collovati-deputes-etranger-v1',
    ],
  },
  {
    id: 'institutions-associations-et-libertes',
    theme: 'institutions',
    title: 'Quelles règles pour les associations et l’exercice des libertés ?',
    terms: 'libertés droits civils vie associative subventions associations',
    versions: [
      'delmur-simplification-associations-v1',
      'markovic-lanceurs-alerte-protection-reconversion-v1',
      'tinland-impot-destination-cultes-associations-v1',
      'pic-financer-parcours-formation-citoyenne-v1',
      'bouamrane-defendre-liberte-de-croire-laicite-v1',
      'collovati-prenoms-enfants-v1',
    ],
  },
  {
    id: 'logement-performance-energetique',
    theme: 'logement',
    title: 'Comment aider ou encadrer la rénovation des logements ?',
    terms:
      'rénovation thermique énergétique MaPrimeRénov DPE logement diagnostic',
    versions: [
      'philippe-maires-distribution-aides-renovation-pierre-v1',
      'rohou-bannir-grandes-structures-metal-verre-batiments-publics-v1',
      'rohou-incitations-travaux-isolation-ancien-v1',
      'collovati-suppression-anah-v1',
      'herlin-supprimer-dpe-v1',
    ],
  },
  {
    id: 'logement-foncier-et-quartiers',
    theme: 'logement',
    title: 'Comment agir sur le foncier et la vie dans les quartiers ?',
    terms:
      'foncier terrains quartiers rénovation urbaine aménagement quartiers prioritaires impôt',
    versions: [
      'markovic-urbanisme-r-plus-deux-faune-v1',
      'tinland-taxe-fonciere-superficie-affectee-commune-v1',
      'rohou-tours-nouvelles-constructions-interdiction-v1',
      'collovati-suppression-politique-ville-v1',
      'herlin-assouplir-droit-foncier-v1',
    ],
  },
  {
    id: 'logement-hebergement-precaire',
    theme: 'logement',
    title: 'Quel hébergement pour les personnes sans logement ?',
    terms: 'sans-abri hébergement urgence mal-logement habitat précaire',
    versions: [
      'delmur-hebergement-familles-vulnerables-v1',
      'markovic-structures-hebergement-animaux-v1',
    ],
  },
  {
    id: 'sante-organisation-hospitaliere',
    theme: 'sante',
    title: 'Comment organiser et financer les soins et l’hôpital ?',
    terms:
      'hôpital public ARS soignants organisation système de santé financement',
    versions: [
      'delmur-primes-soignants-bienveillance-v1',

      'asselineau-ecarter-suppressions-massives-postes-agents-front-v1',
      'collovati-suppression-ars-v1',
      'herlin-reduire-administratif-hopitaux-v1',
    ],
  },
  {
    id: 'sante-prevention',
    theme: 'sante',
    title: 'Quelles actions de prévention en santé ?',
    terms: 'prévention santé soins prévention dépistage addictions',
    versions: [
      'delmur-bien-etre-ecole-travail-v1',
      'markovic-nutrition-formation-soignants-v1',
      'markovic-semaine-nationale-alimentation-vegetale-v1',

      'asselineau-dedommagement-chlordecone-antilles-v1',
    ],
  },
  {
    id: 'securite-police-et-controle',
    theme: 'securite',
    title: 'Quels moyens et quels contrôles pour les forces de l’ordre ?',
    terms:
      'police forces de l’ordre gendarmerie sécurité privée armement protection',
    versions: [
      'delmur-equipes-police-zones-delinquance-v1',
      'delmur-militaires-transports-v1',
      'markovic-detention-armes-particuliers-v1',
      'markovic-fichier-deces-armes-a-feu-v1',
      'asselineau-renforcer-effectifs-police-et-crs-v1',
      'bouamrane-augmenter-effectifs-police-v1',
      'collovati-proteger-sites-sensibles-v1',
      'herlin-armer-securite-privee-v1',
    ],
  },
  {
    id: 'securite-detention-et-peines',
    theme: 'securite',
    title: 'Quelles règles en prison et pour l’exécution des peines ?',
    terms:
      'prison détention peine perpétuité transfèrement peine capitale aménagement',
    versions: [
      'delmur-tags-graffitis-sanctions-v1',
      'delmur-vandalisme-profanations-v1',
      'delmur-prisons-camps-travail-v1',
      'delmur-communications-prison-v1',
      'asselineau-instaurer-peines-planchers-progressives-recidive-v1',
      'collovati-detenus-transfert-pays-origine-v1',
      'collovati-regime-prison-v1',
      'collovati-peine-mort-referendum-v1',
      'collovati-manifestations-reparation-degats-v1',
      'herlin-perpetuite-retroactive-v1',
      'herlin-suppression-proportionnalite-legitime-defense-v1',
    ],
  },
  {
    id: 'securite-organisation-justice',
    theme: 'securite',
    title: 'Comment organiser la justice et garantir son indépendance ?',
    terms: 'justice tribunaux parquet magistrature procédures juridiques juges',
    versions: [
      'pic-secret-defense-acces-juge-v1',
      'pic-juge-administratif-delais-libertes-v1',
      'herlin-recrutement-controle-magistrats-v1',
      'dubuisson-tribunal-universel-appel-cour-supreme-v1',
      'dubuisson-administration-judiciaire-dediee-v1',
    ],
  },
  {
    id: 'securite-enquetes-et-trafics',
    theme: 'securite',
    title: 'Quelles mesures contre les trafics et la criminalité organisée ?',
    terms: 'trafic drogues réseaux criminels prévention enquête criminalité',
    versions: [
      'delmur-militaires-points-deal-v1',
      'delmur-collaboration-demantelement-reseaux-v1',
      'bouamrane-appliquer-methode-saint-ouen-narcotrafic-v1',
      'collovati-detention-avant-jugement-trafic-v1',
      'herlin-enquetes-police-sous-couverture-v1',
    ],
  },
  {
    id: 'securite-surveillance-et-urgence',
    theme: 'securite',
    title: 'Comment encadrer les pouvoirs de surveillance et d’urgence ?',
    terms:
      'état d’urgence couvre-feu surveillance caméras reconnaissance faciale ordre public',
    versions: [
      'pic-classification-secret-defense-delais-et-renouvellement-v1',
      'pic-prohiber-classification-pour-masquer-faute-v1',
      'collovati-couvre-feu-etat-urgence-v1',
      'collovati-reconnaissance-faciale-v1',
    ],
  },
  {
    id: 'social-droits-familles-enfants',
    theme: 'social',
    title: 'Quelles protections pour les enfants et leurs familles ?',
    terms: 'protection enfance placement aide sociale famille ASE parentalité',
    versions: [
      'melenchon-creer-un-controleur-independant-des-lieux-de-placement-des-enfants-v1',
      'delmur-divorce-faute-biens-garde-v1',
      'delmur-non-separation-fratrie-placement-v1',
      'delmur-suivi-enfants-places-v1',
      'markovic-mandat-animal-deces-incapacite-v1',
      'markovic-juge-garde-animaux-couples-separes-v1',
      'markovic-cellules-enfance-protection-animale-v1',
      'rohou-supprimer-incitations-financieres-natalite-v1',
      'collovati-revoir-aide-sociale-enfance-v1',
    ],
  },
  {
    id: 'social-revenus-et-prestations',
    theme: 'social',
    title: 'Qui devrait avoir accès aux aides et aux prestations sociales ?',
    terms:
      'prestations sociales droits pouvoir achat minima sociaux RSA pauvreté',
    versions: [
      'delmur-insertion-grande-precarite-v1',
      'delmur-drom-vie-chere-v1',
      'kazib-augmenter-minima-sociaux-500-euros-v1',
      'labib-controler-prix-alimentaires-comites-quartiers-v1',
      'bouamrane-maintenir-protection-sociale-hors-privatisation-v1',
    ],
  },
  {
    id: 'social-handicap-et-autonomie',
    theme: 'social',
    title: 'Quelles aides pour le handicap et la perte d’autonomie ?',
    terms:
      'handicap autonomie dépendance EHPAD vieillissement droits AAH accessibilité',
    versions: [
      'delmur-handicap-accessibilite-lieux-publics-v1',
      'delmur-aide-maintien-domicile-grand-age-v1',
      'markovic-assistant-animalier-diplome-credit-v1',
      'tinland-taxer-entreprises-non-emploi-handicap-v1',
    ],
  },
  {
    id: 'travail-cotisations-salaires',
    theme: 'travail',
    title: 'Comment modifier les cotisations et la rémunération du travail ?',
    terms:
      'salaires cotisations prélèvements brut net rémunération charges sociales',
    versions: [
      'riner-salaire-net-brut-v1',
      'tinland-remuneration-professionnelle-maximale-v1',
      'herlin-baisser-charges-salariales-v1',
    ],
  },
  {
    id: 'travail-representation',
    theme: 'travail',
    title:
      'Quelle place pour les syndicats et les salariés dans les entreprises ?',
    terms:
      'syndicats représentation dialogue social entreprises actionnariat salarié',
    versions: [
      'kazib-reprendre-total-travailleurs-v1',
      'labib-contester-declaration-prealable-greve-transports-v1',
      'labib-recourir-expropriation-refus-interdire-licenciements-v1',
      'collovati-subventions-syndicats-v1',
      'dubuisson-pool-benefices-33-v1',
    ],
  },
  {
    id: 'travail-industrie-et-innovation',
    theme: 'travail',
    title: 'Comment soutenir la production et l’innovation en France ?',
    terms: 'industrie production relocalisation innovation recherche usines',
    versions: [
      'delmur-origine-francaise-etiquetage-v1',
      'delmur-exportation-soutien-pme-v1',
      'delmur-creation-startup-france-v1',
      'markovic-coproduits-vegetaux-recherche-v1',
      'markovic-brevets-organismes-vivants-v1',
      'rohou-tpe-pme-aide-perennite-v1',
      'collovati-acheter-produire-france-v1',

      'dubuisson-pole-excellence-investisseurs-v1',
    ],
  },
  {
    id: 'travail-acces-emploi',
    theme: 'travail',
    title: 'Comment faciliter l’accès et le retour à l’emploi ?',
    terms:
      'accompagnement France Travail demandeurs emploi formation insertion chômage',
    versions: [
      'markovic-droit-animal-professions-justice-v1',
      'rohou-credit-formation-un-an-non-qualifies-v1',
      'collovati-france-travail-agences-v1',
      'dubuisson-formations-besoins-industrie-v1',
    ],
  },
  {
    id: 'travail-agents-publics',
    theme: 'travail',
    title:
      'Quelles règles pour le recrutement et le statut des agents publics ?',
    terms: 'agents publics fonction publique statut recrutement contractuels',
    versions: [
      'herlin-statut-prive-nouveaux-agents-v1',
      'dubuisson-preparer-changement-mission-agents-publics-v1',
    ],
  },
  {
    id: 'travail-egalite-professionnelle',
    theme: 'travail',
    title: 'Comment garantir l’égalité professionnelle ?',
    terms: 'femmes hommes égalité salariale salaires discrimination entreprise',
    versions: [
      'roussel-travail-egalite-salariale-v1',
      'delmur-egalite-salariale-v1',
      'dubuisson-egalite-salariale-constitution-v1',
    ],
  },
  {
    id: 'institutions-demarches-et-recours',
    theme: 'institutions',
    title: 'Comment simplifier les démarches et garantir les recours ?',
    terms: 'administration démarches service public recours citoyen délais',
    versions: [
      'markovic-experimentations-transparence-documents-v1',
      'markovic-cada-sanction-astreinte-v1',
      'rohou-evaluation-climatique-fermeture-services-publics-v1',

      'dubuisson-assistance-continue-relais-outre-mer-v1',
      'dubuisson-architecture-registres-publics-v1',
    ],
  },
  {
    id: 'institutions-controle-constitutionnel',
    theme: 'institutions',
    title: 'Qui contrôlerait le respect de la Constitution ?',
    terms:
      'contrôle constitutionnel juridiction conseil constitutionnel droits fondamentaux',
    versions: [],
  },
  {
    id: 'numerique-contenu-synthetique',
    theme: 'numerique',
    title:
      'Quelles règles pour les contenus synthétiques et les hypertrucages ?',
    terms:
      'intelligence artificielle deepfake hypertrucage contenu synthétique faux médias',
    versions: [
      'pic-interdire-hypertrucages-de-candidats-par-autorites-publiques-v1',
    ],
  },
  {
    id: 'climat-sources-electricite',
    theme: 'climat',
    title: 'Comment organiser et développer la production d’électricité ?',
    terms:
      'électricité concessions barrages hydroélectricité politique énergétique capacité production',
    versions: [
      'polony-refuser-privatisation-barrages-hydroelectriques-v1',
      'markovic-referendum-nucleaire-renouvelables-vehicules-v1',
      'rohou-autonomie-energetique-menages-communautes-v1',
      'herlin-barrages-edf-v1',
      'legendre-barrages-hydroelectriques-v1',
      'dubuisson-plan-production-electrique-v1',
    ],
  },
  {
    id: 'climat-transports-marchandises',
    theme: 'climat',
    title:
      'Comment encadrer la circulation des véhicules et les transports de marchandises ?',
    terms:
      'automobile véhicules assurance immatriculation fret procédures transport marchandises logistique',
    versions: [
      'dubuisson-registre-national-assurance-immatriculation-v1',
      'dubuisson-billetterie-logistique-controle-v1',
    ],
  },
  {
    id: 'climat-economie-circulaire',
    theme: 'climat',
    title: 'Comment agir sur les déchets, la réparation et le gaspillage ?',
    terms:
      'déchets réemploi recyclage gaspillage alimentaire économie circulaire produits',
    versions: [
      'markovic-convention-don-cantines-v1',
      'markovic-prix-courtes-dates-supermarches-v1',
      'tinland-reparation-recyclage-pieces-detachees-v1',
      'legendre-developper-reparation-reemploi-v1',
    ],
  },
  {
    id: 'climat-peche-aquaculture',
    theme: 'climat',
    title: 'Quelles règles pour la pêche et l’aquaculture ?',
    terms: 'pêche aquaculture poissons écosystèmes filière maritime',
    versions: [
      'markovic-etourdissement-aquatique-v1',
      'markovic-interdire-concentration-poissons-appats-v1',
      'markovic-capture-transport-animaux-aquatiques-v1',
      'markovic-moratoire-pisciculture-v1',
      'markovic-peche-loisir-interdiction-v1',
      'markovic-observation-cetaces-regles-communes-v1',
    ],
  },
  {
    id: 'institutions-services-outre-mer',
    theme: 'institutions',
    title:
      'Comment améliorer les services, les infrastructures et la vie quotidienne outre-mer ?',
    terms:
      'services publics outre-mer Antilles Guyane sargasses Réunion archipels océan Indien',
    versions: [
      'tinland-favoriser-importations-provenance-locale-v1',
      'asselineau-renforcer-equipements-publics-guyane-v1',
      'asselineau-lutter-sargasses-antilles-v1',
      'asselineau-reexaminer-octroi-mer-vie-chere-v1',
      'asselineau-actualite-outremer-journaux-televises-meteos-v1',
      'dubuisson-subsidiarite-adaptee-outre-mer-v1',
      'dubuisson-continuite-antilles-v1',
      'dubuisson-plateforme-ocean-indien-reunion-v1',
      'dubuisson-continuite-archipel-polynesie-v1',
    ],
  },
  {
    id: 'institutions-competences-territoires',
    theme: 'institutions',
    title:
      'Quelles compétences confier aux collectivités et comment les organiser ?',
    terms:
      'collectivités pouvoirs territoires compétences échelons subsidiarité départements',
    versions: [
      'tinland-duree-mandats-conseils-municipaux-v1',
      'tinland-evaluation-citoyenne-elus-locaux-v1',
      'rohou-executifs-territoriaux-suffrage-direct-v1',
    ],
  },
  {
    id: 'travail-commande-publique',
    theme: 'travail',
    title: 'Quels critères privilégier dans la commande publique ?',
    terms: 'marchés publics commande publique achat local emploi fabrication',
    versions: [
      'markovic-commande-publique-bien-etre-animal-v1',
      'markovic-contrats-debouches-filieres-vegetales-v1',
    ],
  },
  {
    id: 'securite-condition-animale',
    theme: 'securite',
    title: 'Comment contrôler et sanctionner les atteintes aux animaux ?',
    terms:
      'justice pénale protection animale inspecteurs tribunaux contrôle mauvais traitements maltraitance',
    versions: [
      'markovic-unites-departementales-protection-animale-v1',
      'markovic-parquets-animaux-tribunaux-judiciaires-v1',
      'markovic-fichier-auteurs-infractions-animaux-v1',
      'markovic-observatoire-protection-animale-v1',
      'markovic-associations-parties-civiles-infractions-animaux-v1',
      'markovic-infractions-etendre-animaux-sauvages-v1',
      'markovic-correctionnaliser-infractions-animaux-v1',
      'markovic-sanctions-mauvais-traitements-professionnels-v1',
      'markovic-dossier-penal-plaintes-animaux-v1',
    ],
  },
  {
    id: 'securite-service-militaire',
    theme: 'securite',
    title: 'Faut-il rendre obligatoire un service national ou militaire ?',
    terms: 'service national militaire obligatoire jeunesse civil conscription',
    versions: [
      'rohou-service-civil-de-proximite-six-mois-v1',
      'polony-se-dire-favorable-service-militaire-obligatoire-v1',
      'dubuisson-service-militaire-civil-obligatoire-v1',
    ],
  },
  {
    id: 'securite-cannabis',
    theme: 'securite',
    title: 'Faut-il revoir le cadre légal du cannabis ?',
    terms: 'cannabis légalisation dépénalisation consommation stupéfiants',
    versions: ['polony-preparer-legalisation-du-cannabis-v1'],
  },
  {
    id: 'fiscalite-epargne-monnaie',
    theme: 'fiscalite',
    title: 'Quelles garanties pour l’épargne en cas de changement de monnaie ?',
    terms:
      'épargne montants dépôts monnaie euro france comptes mouvements capitaux',
    versions: ['pic-publier-epargne-et-mouvements-capitaux-trimestriels-v1'],
  },
  {
    id: 'fiscalite-ecologique',
    theme: 'fiscalite',
    title: 'Quelle fiscalité pour orienter la transition écologique ?',
    terms: 'impôts taxes fiscalité écologique carbone transition',
    versions: [
      'markovic-tva-arbres-arbustes-varietes-locales-v1',
      'markovic-taxer-importations-elevage-intensif-v1',
      'markovic-tva-zero-produits-recycles-france-v1',
      'markovic-tva-produits-animaux-vegetaux-v1',
      'tinland-taxer-fret-distance-parcourue-v1',
      'rohou-tva-phytosanitaires-sans-avantage-v1',
    ],
  },
  {
    id: 'institutions-age-droit-vote',
    theme: 'institutions',
    title: 'À quel âge devrait-on acquérir le droit de vote ?',
    terms: 'droit vote âge seize 16 ans majorité élections',
    versions: ['polony-ne-pas-abaisser-age-vote-16-ans-en-2027-v1'],
  },
  {
    id: 'immigration-accueil-integration',
    theme: 'immigration',
    title:
      'Comment organiser l’accueil et l’intégration des personnes immigrées ?',
    terms: 'accueil intégration immigration réfugiés insertion territoire',
    versions: [
      'polony-repartir-territorialement-personnes-appelees-a-rester-v1',
    ],
  },
  {
    id: 'numerique-reseaux-sociaux-identification',
    theme: 'numerique',
    title:
      'Quelles règles d’âge et d’identification pour accéder aux réseaux sociaux ?',
    terms:
      'réseaux sociaux accès âge majorité numérique utilisateurs pseudonymat',
    versions: ['herlin-controle-age-pseudonymat-v1'],
  },
  {
    id: 'climat-restrictions-publicite',
    theme: 'climat',
    title:
      'Quelles restrictions imposer à la publicité pour des raisons écologiques ?',
    terms:
      'publicité restrictions interdictions produits polluants climat environnement',
    versions: [
      'batho-interdire-publicite-produits-nocifs-v1',
      'melenchon-interdire-publicite-produits-forts-emetteurs-v1',
      'mikolajczak-taxer-a-5-la-publicite-pour-certains-produits-polluants-v1',
    ],
  },
  {
    id: 'institutions-duree-mandat-presidentiel',
    theme: 'institutions',
    title: 'Combien de temps devrait durer le mandat présidentiel ?',
    terms: 'quinquennat septennat durée du mandat présidentiel',
    versions: [
      'branco-retablir-un-mandat-presidentiel-de-sept-ans-v1',
      'herlin-septennat-v1',
      'dlf-septennat-referendum-revocatoire-v1',
      'asselineau-soumettre-retour-septennat-au-referendum-v1',
    ],
  },
  {
    id: 'institutions-haute-administration',
    theme: 'institutions',
    title: 'Comment organiser la haute fonction publique ?',
    terms: 'hauts fonctionnaires corps de l’État préfets inspection diplomatie',
    versions: [
      'dupont-aignan-reconstituer-un-corps-diplomatique-professionnel-v1',
      'lalanne-supprimer-postes-haute-fonction-publique-v1',
      'asselineau-envisager-rotation-hauts-responsables-administration-v1',
      'asselineau-retablir-grands-corps-etat-v1',
    ],
  },
  {
    id: 'institutions-dissolution-assemblee',
    theme: 'institutions',
    title: 'Quand dissoudre l’Assemblée nationale ?',
    terms: 'dissolution Assemblée nationale nouvelles élections législatives',
    versions: [
      'egger-institutions-dissolution-v1',
      'becht-limiter-le-droit-de-dissolution-aux-crises-graves-et-a-lapres-presidentielle-v1',
      'tinland-dissoudre-assemblee-v1',
      'asselineau-dissoudre-assemblee-apres-election-v1',
    ],
  },
  {
    id: 'institutions-conseil-prive-etat',
    theme: 'institutions',
    title: 'Quel recours aux cabinets de conseil privés par l’État ?',
    terms:
      'cabinets privés audit sous-traitance missions conseil administrations',
    versions: [
      'melenchon-interdire-sous-traitance-politiques-publiques-cabinets-v1',
      'pic-cabinets-conseil-dernier-recours-v1',
      'ps-reduire-les-missions-confiees-aux-cabinets-de-conseil-prives-v1',
      'asselineau-restreindre-conseil-prive-administration-v1',
    ],
  },
  {
    id: 'institutions-controle-depense-publique',
    theme: 'institutions',
    title: 'Comment contrôler la gestion et les dépenses publiques ?',
    terms: 'Cour des comptes dépenses gestion publique audit contrôle',
    versions: [
      'becht-creer-une-commission-de-controle-de-la-gestion-publique-avec-cinquante-citoyen-v1',
      'asselineau-renforcer-pouvoir-cour-comptes-v1',
    ],
  },
  {
    id: 'institutions-age-eligibilite-president',
    theme: 'institutions',
    title: 'Quel âge minimum pour exercer la présidence ?',
    terms: 'âge minimum président présidence éligibilité âge requis candidat',
    versions: ['asselineau-fixer-age-minimum-president-50-ans-v1'],
  },
  {
    id: 'institutions-liberte-medias',
    theme: 'institutions',
    title: 'Comment protéger la liberté des médias ?',
    terms:
      'médias presse liberté d’expression journalistes fermeture sanctions',
    versions: [
      'arthaud-critiquer-fermeture-cnews-lutte-racisme-v1',
      'melenchon-proteger-journalistes-manifestations-v1',
      'melenchon-ecarter-les-tribunaux-de-commerce-des-procedures-sur-la-liberte-de-la-presse-v1',
      'asselineau-privilegier-justice-a-fermeture-medias-v1',
    ],
  },
  {
    id: 'europe-cooperations-industrielles',
    theme: 'europe',
    title: 'Quelles coopérations industrielles avec d’autres pays ?',
    terms: 'coopération internationale industrie Chine technologie recherche',
    versions: [
      'roussel-institutions-cooperation-recherche-ia-v1',
      'asselineau-developper-cooperation-industrielle-avec-chine-v1',
    ],
  },
  {
    id: 'institutions-protection-patrimoine',
    theme: 'institutions',
    title: 'Comment protéger le patrimoine culturel ?',
    terms: 'monuments protection patrimoine musées conservation collections',
    versions: [
      'dlf-patrimoine-plan-urbanisme-v1',
      'melenchon-fonds-sauvegarde-petit-patrimoine-rural-v1',
      'saforcada-plans-sauvegarde-patrimoine-crises-v1',
      'asselineau-confier-representation-patrimoine-comte-paris-v1',
    ],
  },
  {
    id: 'education-acces-culture',
    theme: 'education',
    title: 'Comment faciliter l’accès des jeunes à la culture ?',
    terms: 'visites scolaires accès culture patrimoine musées élèves jeunes',
    versions: [
      'dlf-ticket-decouverte-culture-v1',
      'becht-creer-des-visites-de-musees-a-distance-en-trois-dimensions-v1',
      'asselineau-organiser-visites-scolaires-patrimoine-v1',
    ],
  },
  {
    id: 'sante-protection-ivg',
    theme: 'sante',
    title: 'Comment protéger l’accès à l’IVG ?',
    terms:
      'avortement interruption volontaire grossesse constitution accès ivg',
    versions: [
      'labib-defendre-acces-effectif-ivg-v1',
      'kazib-ivg-pma-transitions-v1',
      'rohou-maintenir-protection-constitutionnelle-ivg-v1',
    ],
  },
  {
    id: 'securite-lutte-racisme',
    theme: 'securite',
    title: 'Comment lutter contre le racisme et les discriminations racistes ?',
    terms: 'racisme discriminations plainte prévention recours victimes',
    versions: [
      'roussel-plan-contre-racisme-discriminations-v1',
      'villepin-reunir-une-commission-sur-le-racisme-lantisemitisme-et-lislamophobie-v1',
      'melenchon-former-les-agents-publics-au-contact-du-public-a-la-lutte-contre-les-racismes-v1',
    ],
  },
  {
    id: 'logement-attribution-nationalite',
    theme: 'logement',
    title:
      'La nationalité doit-elle compter dans l’attribution d’un logement social ?',
    terms:
      'HLM priorité préférence nationale nationalité attribution logements sociaux',
    versions: [
      'lepen-logement-priorite-nationale-v2',
      'arthaud-immigration-logement-v1',
      'bouamrane-refuser-preference-nationale-logement-social-v1',
    ],
  },
  {
    id: 'institutions-finances-communes',
    theme: 'institutions',
    title: 'Quels moyens financiers pour les communes ?',
    terms:
      'communes financement collectivités maires budget visibilité moyens fiscalité locale',
    versions: [
      'riner-visibilite-budgetaire-communes-six-ans-v2',
      'riner-donner-aux-maires-moyens-de-leurs-responsabilites-v2',
    ],
  },
  {
    id: 'travail-conditions-aides-entreprises',
    theme: 'travail',
    title: 'Quelles conditions pour les aides publiques aux entreprises ?',
    terms:
      'critères conditionner subventions exonérations entreprises emploi responsabilité sociale environnementale',
    versions: [
      'bouamrane-conditionner-aides-entreprises-investissement-emploi-v1',
      'melenchon-conditionner-aides-entreprises-territoires-fragiles-v1',
      'groupe-rn-reprendre-aides-entreprises-delocalisent-v1',
      'dubuisson-remplacer-aides-publiques-entreprises-allegement-charges-v1',
      'billetdoux-aides-entreprises-v4',
    ],
  },
  {
    id: 'institutions-service-civique-obligatoire',
    theme: 'institutions',
    title: 'Faut-il rendre le service civique obligatoire ?',
    terms: 'service civique obligatoire volontaire jeunes engagement',
    versions: [
      'dupont-aignan-service-civique-trois-mois-v1',
      'ecologistes-accroitre-le-nombre-de-missions-de-service-civique-volontaire-v1',
      'mathieu-soumettre-service-civique-obligatoire-au-referendum-v1',
    ],
  },
  {
    id: 'education-rythmes-scolaires',
    theme: 'education',
    title: 'Comment organiser les rythmes scolaires ?',
    terms: 'temps de l’enfant horaires rythmes scolaires semaine école',
    versions: ['lisnard-autonomie-locale-rythmes-scolaires-v1'],
  },
  {
    id: 'institutions-information-referendaire',
    theme: 'institutions',
    title: 'Comment informer le public avant un référendum ?',
    terms:
      'référendum campagnes référendaires information médias débats contradictoires',
    versions: [
      'mathieu-publier-avis-contradictoires-avant-referendum-v1',
      'mathieu-encadrer-information-pendant-campagnes-referendaires-v1',
    ],
  },
  {
    id: 'travail-aides-cooperatives',
    theme: 'travail',
    title:
      'Comment soutenir les coopératives et développer leur place dans l’économie ?',
    terms: 'coopératives SCOP SCIC entreprises soutien aides sociales',
    versions: [
      'melenchon-cooperatives-gouvernance-partagee-v1',
      'roussel-ess-cooperatives-activite-emploi-alternative-uberisation-v1',
      'tinland-cooperatives-reparation-v1',
    ],
  },
  {
    id: 'sante-experimentation-animale',
    theme: 'sante',
    title: 'Quel avenir pour l’expérimentation animale dans la recherche ?',
    terms:
      'expérimentation animale méthodes alternatives recherche sans animaux laboratoires validation',
    versions: [
      'delmur-interdire-experimentation-animale-v1',
      'melenchon-remplacer-experimentation-animale-v1',
      'philippot-experimentation-animale-alternatives-v1',
    ],
  },
  {
    id: 'institutions-voile-espace-public',
    theme: 'institutions',
    title: 'Faut-il interdire le port du voile dans l’espace public ?',
    terms: 'voile espace public libertés religieuses port interdiction',
    versions: ['platret-interdiction-voile-espace-public-v1'],
  },
  {
    id: 'travail-automatisation-intelligence-artificielle',
    theme: 'travail',
    title:
      'Que faire quand l’IA ou des machines remplacent des tâches au travail ?',
    terms:
      'intelligence artificielle IA emploi automatisation remplacement du travail guichets machines',
    versions: [
      'arthaud-ia-planification-usages-v2',
      'melenchon-associer-les-representants-des-metiers-a-la-conception-des-ia-au-travail-v1',
      'revillon-apreval-repartir-temps-travail-apres-automatisation-v2',
    ],
  },
  {
    id: 'europe-accord-mercosur',
    theme: 'europe',
    title:
      'Quelles positions sur l’accord commercial entre l’Union européenne et le Mercosur ?',
    terms: 'Union européenne Mercosur commerce clause miroir importations',
    versions: [
      'attal-refuser-mercosur-v1',
      'collovati-suspendre-laccord-avec-le-mercosur-v1',
      'lisnard-mercosur-exclure-elevage-ou-clause-miroir-v1',
      'markovic-parti-refuser-traite-ue-mercosur-v1',
    ],
  },
  {
    id: 'institutions-revocation-elus',
    theme: 'institutions',
    title: 'Les élus pourraient-ils être révoqués en cours de mandat ?',
    terms: 'révocation des élus mandats révocables référendum révocatoire',
    versions: [
      'branco-institutions-mandats-revocables-v1',
      'dlf-septennat-referendum-revocatoire-v1',
      'melenchon-institutions-2-v1',
      'pic-mandat-imperatif-revocable-v1',
    ],
  },
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
      'billetdoux-remuneration-agriculteurs-v2',
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
      'markovic-aider-reconversion-eleveurs-v3',
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
      'lepen-europe-1-v3',
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
      'polony-aider-ukraine-negociations-v1',
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
      'polony-maintenir-commandement-integre-otan-v1',
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
    'zemmour-retraites-age-65-2032-v1',
    'herlin-retraite-choix-age-v1',
    'asselineau-faire-dependre-depart-retraite-duree-cotisation-v1',
    'saforcada-remplacer-age-legal-par-40-a-43-annuites-v1',
    'tinland-taux-plein-55-60-v1',
    'lepen-fixer-un-plancher-de-160-trimestres-v1',
    'revillon-apreval-retraite-socle-70-puis-85-ans-v2',
    'lepen-cantonner-trimestres-chomage-v1',
    'lepen-abroger-reforme-retraites-2023-en-2028-v1',
    'lisnard-age-legal-65-ans-43-ans-et-demi-cotisation-v2',
    'bonnal-taux-plein-retraite-41-annuites-v1',
  ],
  'travail-salaire-minimum': [
    'saforcada-renegocier-grilles-branches-rattrapees-smic-v1',
    'lepen-geler-cotisations-hausses-volontaires-salaires-v1',
    'tinland-revaloriser-smic-v1',
    'bonnal-smic-revalorisation-automatique-v1',
    'glucksmann-revaloriser-smic-1700-net-v1',
    'philippe-travail-2-v4',
    'philippe-privilegier-heures-supplementaires-hausse-smic-novembre-v1',
  ],
  'travail-duree-travail': [
    'lisnard-majoration-heures-supplementaires-10-v1',
    'tinland-reduire-duree-travail-v1',
    'platret-retour-39-heures-v1',
    'villepin-reserver-aux-partenaires-sociaux-certains-choix-sur-les-salaires-et-le-temps-de-v1',
    'ecologistes-passer-a-32-heures-sans-baisse-de-salaire-pour-les-metiers-penibles-ou-de-nu-v1',
    'lisnard-temps-de-travail-accords-v1',
    'ps-experimenter-la-semaine-de-quatre-jours-par-la-negociation-collective-v1',
  ],
  'climat-production-nucleaire': [
    'renaissance-lancer-un-plan-pour-produire-industriellement-des-petits-reacteurs-nucleair-v1',
    'retailleau-conditionner-commande-huit-epr2-avancement-v1',
    'polony-soutenir-investissement-epr2-v1',
    'tinland-sortie-nucleaire-solaire-v1',
    'marchal-construire-centrales-nucleaires-v1',
    'bouamrane-nucleaire-geothermie-sortie-fossiles-v1',
    'attal-plan-messmer-2-v1',
    'villepin-poursuivre-le-programme-de-six-reacteurs-epr2-v1',
    'melenchon-fermer-les-centrales-nucleaires-et-arreter-les-epr2-v1',
    'lisnard-prolonger-reacteurs-nucleaires-60-ans-v1',
    'lisnard-nouveaux-epr-et-mini-reacteurs-v1',
    'groupe-rn-accroitre-production-nucleaire-2025-v1',
  ],
  'climat-prix-energie': [
    'place-publique-tarif-electricite-couts-production-francais-v1',
    'philippe-nov28-doubler-laide-aux-carburants-pour-les-menages-les-plus-exposes-v1',
    'zemmour-supprimer-certificats-economies-energie-carburants-v1',
    'collovati-marche-europeen-electricite-v1',
    'herlin-marche-europeen-electricite-v1',
    'legendre-prix-energie-cheques-v1',
    'dubuisson-tva-achat-fioul-v1',
    'dubuisson-fiscalite-carburants-v1',
    'dubuisson-electricite-accises-cta-tva-v1',
    'becht-envisager-baisse-ticpe-carburants-v1',
    'saforcada-prix-electricite-fonde-couts-francais-v1',
    'tinland-tva-energie-5-5-v1',
    'polony-taxe-flottante-produits-petroliers-v1',
    'melenchon-retablir-tarifs-reglementes-energie-couts-production-v1',
    'arthaud-climat-carburant-coutant-v2',
    'marchal-accord-operateurs-carburants-v1',
    'delmur-tarif-social-energie-v1',
    'attal-stabilite-prix-electricite-v1',
    'retailleau-stabiliser-le-prix-de-lelectricite-par-un-contrat-a-double-sens-v1',
    'philippe-baisser-prix-electricite-industriels-v1',
    'villepin-encadrer-le-prix-des-carburants-par-la-fiscalite-v1',
    'lalanne-fiscalite-taxes-carburants-v1',
    'lepen-renegocier-prix-electricite-europe-v3',
    'glucksmann-moratoire-hausses-taxes-electricite-v1',
    'patriotes-quitter-le-marche-europeen-de-lelectricite-v2',
  ],
  'fiscalite-csg-salaires': [
    'saforcada-reduire-csg-salaires-deux-tranches-v1',
    'lisnard-baisser-csg-revenus-activite-66-v1',
    'melenchon-fusionner-les-cotisations-sociales-et-la-csg-v1',
  ],
  'fiscalite-transmission-patrimoine': [
    'attal-nov28-faciliter-donations-v1',
    'lepen-contre-budget-reformer-donations-grands-parents-v1',
    'philippe-perenniser-defiscalisation-donations-premier-achat-v1',
    'herlin-droits-succession-v1',
    'collovati-relever-le-seuil-dimposition-des-successions-v1',
    'philippot-petits-heritages-v1',
    'mikolajczak-mettre-fin-a-leffacement-des-plus-values-latentes-lors-dune-succession-v1',
    'groupe-rn-successions-immobilier-300000-v2',
    'becht-exonerer-de-droits-de-succession-le-capital-maintenu-sept-ans-dans-le-fonds-ma-v1',
    'billetdoux-heritage-bareme-v2',
    'glucksmann-grands-heritages-v2',
    'glucksmann-imposer-plus-values-latentes-transmises-v1',
    'lisnard-exonerer-transmission-entreprises-droits-succession-v1',
    'lisnard-ramener-taux-marginal-succession-20-v1',
  ],
  'regularisation-sejour': [
    'attal-nov28-schengen-aucune-regularisation-massive-seul-v1',
    'roussel-congres-regulariser-familles-enfants-scolarises-v1',
    'labib-regulariser-tous-les-sans-papiers-v1',
    'philippe-soumettre-les-regularisations-massives-a-un-accord-entre-etats-schengen-v1',
    'lisnard-interdire-regularisation-apres-entree-clandestine-v1',
  ],
  'immigration-travail': [
    'attal-nov28-preference-travail-constitution-v1',
    'retailleau-saisonniers-titres-sans-installation-v1',
    'lisnard-instaurer-carte-verte-a-la-francaise-v1',
    'dubuisson-immigration-choisie-filieres-v1',
    'saforcada-titre-probatoire-immigration-travail-3-6-mois-v1',
    'lepen-taxe-embauche-extracommunautaires-v1',
    'legendre-exiger-une-demande-prealable-a-lambassade-pour-limmigration-economique-v1',
    'bonnal-regularisation-cas-par-cas-metiers-en-tension-v1',
    'dupont-aignan-conditionner-limmigration-economique-au-niveau-du-chomage-v1',
    'philippe-introduire-des-quotas-dimmigration-selon-les-profils-recherches-v1',
    'groupe-rn-creer-une-taxe-a-lembauche-dun-salarie-extra-europeen-v2',
  ],
  'soins-de-proximite': [
    'place-publique-former-soignants-hopitaux-non-universitaires-v1',
    'lisnard-statut-cabinet-telemedecine-exclusive-v1',
    'lepen-outremer-moderniser-infrastructures-hopital-v1',
    'delmur-soins-sans-domicile-v1',
    'delmur-urgences-soins-vitaux-v1',
    'dubuisson-equipes-mobiles-soins-v1',
    'dubuisson-reinvestir-economies-soins-v1',
    'batho-renforcer-radiologie-mammographies-territoires-v1',
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
    'patriotes-centres-soins-non-vitaux-v2',
  ],
  'sante-installation-medecins': [
    'marchal-inciter-specialistes-zones-sous-dotees-v1',
    'philippe-reguler-installation-medecins-si-echec-v1',
    'philippe-former-medecins-assistants-infirmiers-v1',
    'tinland-soins-proximite-medecins-v1',
    'batho-installation-medecins-centres-sante-v1',
    'dlf-bourse-medecins-zones-sous-dotees-v1',
    'branco-sante-implantation-medicale-v1',
    'melenchon-guichet-installation-soignants-v1',
  ],
  'sante-remboursement-soins': [
    'place-publique-mutualiser-systemes-information-remboursements-sante-v1',
    'lepen-contre-budget-rendre-carte-vitale-biometrique-v1',
    'lepen-contre-budget-detecter-fraude-factures-sante-v1',
    'lepen-contre-budget-radiographies-membres-inferieurs-v1',
    'lepen-contre-budget-lunettes-fabriquees-france-cent-pour-cent-sante-v1',
    'markovic-nutritionniste-rendez-vous-rembourse-v1',

    'marchal-tarif-opposable-specialistes-v1',
    'tinland-soins-gratuits-v1',
    'lisnard-sante-1-v3',
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
    'markovic-ric-seuil-million-v1',
    'rohou-vote-local-centres-donnees-majorite-qualifiee-v1',
    'pic-referendum-question-principe-contentieux-administratif-v1',

    'herlin-referendums-presidentiels-v1',
    'mathieu-envisager-ric-legislatif-et-conventions-v1',
    'mlekuz-envisager-article-11-si-absence-majorite-v1',
    'saforcada-elargir-perimetre-referendum-presidentiel-article-11-v1',
    'saforcada-remplacer-rip-petition-suivie-vote-parlementaire-v1',
    'rn-soutenir-referendum-initiative-citoyenne-v1',
    'philippe-referendum-cadre-articles-11-et-89-v1',
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
    'place-publique-accroitre-budget-ue-ressources-propres-v1',
    'place-publique-reconnaissance-transfrontaliere-filiations-unions-v1',
    'attal-nov28-etats-unis-d-europe-v1',
    'retailleau-ecarter-regles-europe-incompetence-v1',
    'zemmour-reduire-budget-et-role-commission-europeenne-v1',
    'zemmour-knafo-budget-europe-avant-covid-v1',
    'lepen-mettre-fin-soutien-ue-turquie-v1',
    'lepen-conserver-calendrier-negociation-budget-ue-v1',
    'delmur-nouveaux-accords-apres-frexit-v1',
    'markovic-modifier-article-13-tfue-animaux-v1',
    'mlekuz-confier-articulation-droits-constituante-v1',
    'asselineau-reporter-versements-ue-delai-negociations-v1',
    'herlin-sortie-conditionnelle-euro-v1',
    'legendre-renegocier-regles-europeennes-v1',
    'melenchon-non-regression-sociale-ecologique-transposition-ue-v1',
    'melenchon-vote-parlement-moratoire-regles-europeennes-v1',
    'roussel-congres-cooperations-europeennes-choisies-v1',
    'tinland-referendum-union-europeenne-v1',
    'polony-maintenir-france-union-europeenne-v1',
    'lepen-commission-au-service-des-etats-v1',
    'lepen-refuser-elargissement-ue-v1',
    'melenchon-rester-dans-union-et-euro-negocier-traites-v1',
    'lisnard-traite-pouvoirs-conseil-parlement-europeen-v1',
    'lisnard-demander-derogation-europeenne-asile-immigration-v1',
    'philippe-approfondir-cooperation-ue-domaines-strategiques-v1',
    'place-publique-traiter-elargissement-refondation-ue-2030-v1',
    'dlf-referendum-appartenance-ue-v1',
  ],
  'institutions-logiciels-publics': [
    'dlf-logiciels-administrations-licences-gratuites-v1',
  ],
  'agriculture-remuneration-contrats': [
    'place-publique-autorite-europeenne-prix-alimentaires-v1',
    'retailleau-negociations-commerciales-date-butoir-decembre-v1',
    'lepen-outremer-augmenter-credits-posei-v1',
    'philippe-accords-pluriannuels-partage-valeur-agricole-v1',
    'saforcada-rendre-couts-complets-production-agricole-opposables-v1',
    'saforcada-prix-planchers-agricoles-sauvegarde-temporaire-v1',
    'saforcada-renforcer-controle-marges-filieres-agricoles-v1',
    'lepen-agriculture-prix-installation-jeunes-v1',
    'lisnard-services-environnementaux-agriculteurs-v2',
    'lisnard-charges-agricoles-valeur-ajoutee-v2',
    'legendre-revenu-minimum-agriculteurs-v1',
    'patriotes-garantir-des-prix-planchers-aux-agriculteurs-v1',
    'dlf-prix-garantis-agricoles-v1',
  ],
  'agriculture-installation-fermes': [
    'lepen-outremer-installation-agriculteurs-transformation-v1',
    'saforcada-diagnostic-guichet-installation-transmission-agricole-v1',
    'lisnard-credit-impot-transmission-fermes-v1',
    'philippe-aider-installation-transmission-fermes-v1',
    'philippe-creer-un-dispositif-fiscal-de-transmission-des-exploitations-v2',
    'lepen-agriculture-prix-installation-jeunes-v1',
    'tinland-fermes-circuits-courts-v1',
    'dlf-garantie-installation-agricole-v1',
    'dlf-reformer-safer-v1',
  ],
  'agriculture-cantines': [
    'lepen-outremer-cantines-hopitaux-produits-locaux-v1',
    'saforcada-priorite-produits-francais-restauration-publique-v1',
    'groupe-rn-restauration-collective-criteres-locaux-v1',
    'polony-commande-production-v2',
    'tinland-restauration-collective-locale-v1',
    'delmur-cantines-locales-bio-v1',
    'pic-prix-plancher-agricole-v1',
    'ps-adapter-le-prix-de-la-cantine-aux-revenus-des-familles-jusquau-lycee-v1',
    'dlf-achats-publics-agricoles-v1',
    'melenchon-cantines-bio-local-option-vegetarienne-v1',
  ],
  'logement-obligations-parc-social': [
    'glucksmann-maintenir-obligations-logement-social-sru-v1',
    'lisnard-negocier-quotas-sru-territoires-v1',
    'zemmour-abroger-loi-sru-v1',
    'ps-reviser-loi-sru-sanctionner-villes-carencees-v1',
    'tinland-maires-permis-logements-sociaux-v1',
    'bonnal-maintenir-quotas-loi-sru-v1',
    'roussel-sru-30-logements-sociaux-v1',
    'dlf-accession-sociale-quota-sru-v1',
    'dlf-seuil-logements-sociaux-communes-v1',
    'lisnard-supprimer-article-55-de-la-loi-sru-v1',
  ],
  'logement-offre-bati': [
    'melenchon-convertir-locaux-vacants-en-logements-v1',
    'melenchon-logements-tres-sociaux-plai-v1',
    'melenchon-40-mille-logements-seniors-v1',
    'melenchon-soutenir-communes-construction-accessible-v1',
    'melenchon-renforcer-etablissements-publics-fonciers-v1',
    'place-publique-preemption-vacance-longue-bareme-progressif-v1',
    'melenchon-mobiliser-encours-livret-a-financer-logements-v1',
    'lisnard-exonerer-taxe-vacance-en-travaux-v1',
    'retailleau-viser-million-logements-supplementaires-quinquennat-v1',
    'lepen-outremer-pret-taux-zero-construction-v1',
    'zemmour-knafo-supprimer-anah-v1',
    'kazib-mobiliser-bureaux-inutilises-logement-v1',
    'philippe-regrouper-bailleurs-foncieres-interet-general-v1',
    'saforcada-mobiliser-foncier-public-logement-outre-mer-v1',
    'saforcada-strategie-construction-rehabilitation-logements-vacants-v1',
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
    'polony-hausse-remuneration-enseignants-vingt-trente-v2',
    'mikolajczak-relever-le-salaire-des-professeurs-des-ecoles-de-200-euros-nets-par-mois-v1',
    'retailleau-relever-le-salaire-des-enseignants-en-debut-et-milieu-de-carriere-v1',
    'becht-formation-remuneration-enseignants-v2',
    'ecologistes-augmenter-de-15-en-cinq-ans-le-salaire-des-enseignants-v1',
    'dlf-salaires-nets-professeurs-quinze-v1',
    'branco-salaires-enseignants-debut-carriere-v1',
  ],
  'education-acces-etudes': [
    'place-publique-controle-enseignement-superieur-prive-lucratif-v1',
    'place-publique-renover-campus-energie-biodiversite-v1',
    'philippe-nov28-laisser-chaque-universite-definir-ses-propres-regles-de-selection-v1',
    'labib-garantir-place-master-apres-licence-v1',

    'lepen-publier-criteres-admission-superieur-v1',
    'polony-reformer-parcoursup-transparence-v1',
    'lisnard-remplacer-parcoursup-orientation-v1',
    'philippe-conserver-ameliorer-parcoursup-orientation-v1',
    'roussel-remplacer-parcoursup-monmaster-v1',
    'becht-remplacer-parcoursup-par-une-epreuve-dadmission-liee-a-la-specialite-v1',
    'place-publique-abroger-parcoursup-etats-generaux-orientation-v1',
  ],
  'institutions-ecrire-constitution': [
    'mlekuz-renouveler-constituants-apres-echec-referendum-v1',
    'saforcada-referendum-obligatoire-revision-souverainete-v1',
    'lisnard-reviser-constitution-directement-par-referendum-v1',
    'place-publique-convention-preparer-constituante-v1',
    'lepen-plafonner-deficit-au-seuil-de-stabilisation-de-la-dette-v1',
    'philippe-fiscalite-2-v4',
    'mathieu-institutions-convention-500-v1',
    'mathieu-convention-controle-impartialite-v1',
    'mlekuz-garants-constituante-v1',
    'mlekuz-constituante-apres-refus-v1',
  ],
  'institutions-contributions-citoyennes': [
    'cheve-faire-presidence-intermediaire-citoyens-v1',
    'cheve-reexaminer-reglements-apres-remontee-v1',
    'mathieu-faire-valider-conclusions-conventions-par-referendum-v1',
    'mathieu-convention-citoyenne-education-150-v1',
    'roussel-congres-convention-citoyenne-projet-loi-v1',
    'tinland-consultations-publiques-v1',
    'lisnard-referendum-initiative-populaire-v1',
    'rn-soutenir-referendum-initiative-citoyenne-v1',
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
    'lisnard-envisager-sous-indexation-certaines-pensions-si-deficit-persiste-v2',
    'ps-garantir-85-du-smic-apres-une-carriere-entiere-dans-lagriculture-v1',
  ],
  'retraites-financement-regimes': [
    'place-publique-haut-conseil-pilotage-retraites-paritarisme-v1',
    'retailleau-credit-impot-per-non-imposables-v1',
    'retailleau-affecter-participation-interessement-retraite-v1',
    'zemmour-retraites-transition-capitalisation-v1',
    'herlin-retraite-capitalisation-choix-placements-v1',
    'dubuisson-maintien-pensions-transition-v1',
    'asselineau-maintenir-retraites-par-repartition-v1',
    'pic-retraites-capitalisation-collective-v1',
    'attal-interessement-vers-epargne-retraite-v1',
    'philippe-plan-epargne-premier-emploi-v1',
  ],
  'logement-regulation-loyers': [
    'place-publique-extension-visale-public-duree-v1',
    'glucksmann-encadrer-loyers-zones-tendues-declaration-lci-v1',
    'legendre-encadrement-loyers-aides-v1',
    'tinland-loyers-15-pour-cent-v1',
    'delmur-encadrement-loyers-v1',
    'melenchon-blocage-loyers-urgence-sociale-v1',
    'philippe-donner-aux-maires-la-decision-sur-lencadrement-des-loyers-v1',
  ],
  'social-garde-jeunes-enfants': [
    'renaissance-instaurer-un-droit-opposable-a-la-garde-denfants-v1',
    'tinland-conge-parental-et-garde-v1',
    'philippe-plan-garde-enfants-v1',
    'place-publique-rendre-opposable-droit-a-la-garde-enfant-v1',
    'branco-rendre-opposable-le-droit-a-une-place-en-creche-v1',
    'villepin-planifier-les-places-daccueil-de-la-petite-enfance-par-territoire-v1',
    'dlf-places-creches-cinq-ans-v1',
    'attal-social-professionnels-enfance-v1',
    'glucksmann-soustraire-creches-ehpad-logique-marchande-v1',
    'place-publique-contrat-creches-privees-v1',
  ],
  'france-otan': [
    'durif-sortir-de-lotan-sous-condition-v1',
    'tinland-otan-v1',
    'lepen-sortir-commandement-integre-otan-v1',
    'lisnard-maintenir-cadre-atlantique-a-court-terme-v1',
    'philippe-participer-pleinement-otan-pilier-europeen-v2',
    'roussel-remplacer-otan-architecture-securite-europeenne-v1',
    'lalanne-europe-otan-v1',
    'philippot-europe-organisations-v1',
    'legendre-maintenir-renforcer-alliances-dont-otan-v1',
  ],
  'retraites-regimes-particuliers': [
    'attal-lci-remplacer-les-regimes-distincts-de-retraite-par-des-regles-communes-v1',
    'lisnard-mettre-fin-regimes-speciaux-v1',
    'marchal-agir-regimes-speciaux-pensions-hautes-v1',
  ],
  'retraites-penibilite': [
    'marchal-depart-60-penibilite-v1',
    'saforcada-reconnaitre-penibilite-physique-horaires-psychologique-retraite-v1',
    'lisnard-criteres-usure-retraite-v1',
    'bouamrane-adapter-age-depart-a-penibilite-v1',
    'glucksmann-avancer-departs-metiers-penibles-v1',
    'roussel-ouvrir-des-departs-anticipes-pour-les-metiers-penibles-et-les-carrieres-longue-v1',
  ],
  'climat-avenir-eolien': [
    'markovic-implantation-antennes-eoliennes-vote-local-v1',
    'collovati-subventions-eoliennes-v1',
    'rohou-ecarter-renouvellement-eoliennes-problematiques-v1',
    'lisnard-eolien-certains-projets-et-reserve-en-mer-v1',
    'place-publique-plans-regionaux-renouvelables-vent-v1',
    'tinland-arreter-eolien-v1',
    'retailleau-interrompre-des-appels-doffres-solaires-et-eoliens-en-mer-v1',
    'melenchon-refuser-les-parcs-solaires-et-eoliens-qui-exigent-une-coupe-rase-v1',
    'groupe-rn-moratoire-eolien-et-solaire-2025-v1',
  ],
  'regroupement-familial': [
    'retailleau-verifier-etat-civil-regroupement-pays-liste-v1',
    'saforcada-suspendre-puis-durcir-regroupement-familial-v1',
    'rn-supprimer-regroupement-familial-v1',
    'herlin-regroupement-familial-v1',
    'becht-limiter-le-regroupement-familial-pour-les-personnes-hors-union-europeenne-v1',
    'dupont-aignan-restreindre-le-regroupement-familial-et-supprimer-le-regime-derogatoire-des-re-v1',
    'zemmour-supprimer-regroupement-familial-v1',
  ],
  'handicap-accompagnement-ecole': [
    'groupe-rn-cadre-emploi-aesh-v1',
    'attal-corps-professionnel-aesh-v1',
    'roussel-aesh-des-la-rentree-v1',
    'branco-aesh-concours-titularisation-v1',
    'becht-revaloriser-les-accompagnants-deleves-en-situation-de-handicap-et-ouvrir-davan-v1',
    'dlf-aesh-temps-plein-v1',
  ],
  'parents-isoles': [
    'attal-nov28-versement-automatique-pensions-v1',
    'philippe-social-1-v4',
    'delmur-pension-alimentaire-salaire-v1',
    'becht-confier-une-mission-daide-aux-familles-monoparentales-aux-maisons-de-vie-v1',
    'melenchon-creer-statut-famille-monoparentale-v1',
  ],
  'places-prison': [
    'attal-nov28-prisons-operation-interet-national-v1',
    'lisnard-tester-detention-transitoire-pays-partenaires-v1',
    'retailleau-faire-construire-places-prison-par-differents-acteurs-v1',
    'zemmour-prisons-100000-places-v2',
    'saforcada-construire-capacites-detention-et-separer-profils-v1',
    'zemmour-prisons-100000-places-v1',
    'herlin-places-prison-v1',
    'becht-places-prisons-haute-securite-v1',
    'riner-construire-places-prison-v3',
  ],
  'agriculture-ogm': [
    'rn-delegation-soutenir-cadre-europeen-ntg-v1',
    'tinland-interdire-ogm-v1',
    'lisnard-autoriser-ntg-v2',
  ],
  'statuts-outre-mer': [
    'roussel-congres-autodetermination-outre-mer-v1',
    'villepin-permettre-aux-territoires-ultramarins-de-choisir-une-evolution-vers-lautonomie-v1',
    'melenchon-statut-collectivite-unique-v1',
  ],
  'mobilite-territoires': [
    'roussel-mobilites-autocars-peu-polluants-ruralite-v1',
    'roussel-mobilites-permis-gratuit-moins-25-ans-v1',
    'melenchon-rouvrir-lignes-ferroviaires-quotidien-v1',
    'melenchon-transports-demande-zones-peu-desservies-v1',
    'groupe-rn-permis-jeunes-v2',
    'lisnard-investir-infrastructures-des-enclaves-v1',
    'place-publique-service-public-transports-ruraux-v1',
    'place-publique-plan-rail-trains-legers-ruraux-v1',
  ],
  'numerique-demarches-en-ligne': [
    'lisnard-dossier-conforme-format-delai-correction-v1',
    'lisnard-rendre-opposable-donnees-une-fois-v1',
    'lisnard-guichet-numerique-agriculteurs-v2',
    'polony-guichet-numerique-services-publics-v1',
    'dubuisson-eviter-redemande-documents-administratifs-v2',
    'pic-droits-services-hors-ligne-v1',
    'dlf-accessibilite-services-publics-numeriques-v1',
    'ecologistes-garantir-un-accueil-physique-de-service-public-a-quinze-minutes-v1',
  ],
  'immigration-droit-sol': [
    'collovati-nationalite-enfants-parents-etrangers-v1',
    'saforcada-maintenir-droit-sol-avec-demarche-volontaire-v1',
    'roussel-congres-maintenir-droit-sol-et-asile-v1',
    'lisnard-fin-automaticite-droit-du-sol-v1',
    'tinland-citoyennete-residence-nationalite-v1',
    'melenchon-garantir-droit-du-sol-integral-v1',
    'lepen-supprimer-droit-du-sol-parti-v1',
    'zemmour-supprimer-droit-du-sol-v1',
  ],
  'immigration-aide-medicale-etat': [
    'collovati-aide-medicale-etat-v1',
    'melenchon-maintenir-acces-ame-soutien-psychosocial-asile-v1',
    'philippe-maintenir-ame-avec-controles-v1',
    'lisnard-remplacer-ame-par-aide-medicale-urgence-v1',
  ],
  'education-eleves-par-classe': [
    'glucksmann-reduire-eleves-classes-du-primaire-v1',
  ],
  'numerique-hebergement-sante': [
    'lisnard-cadre-souverain-hebergement-donnees-sante-v1',
    'polony-privilegier-acteurs-souverains-donnees-sante-v1',
  ],
  'agriculture-elevages': [
    'markovic-autorite-inspection-elevages-abattoirs-v1',
    'markovic-visites-parlementaires-lieux-animaux-v1',
    'markovic-abaisser-seuils-declaration-elevages-v1',
    'markovic-abattage-etourdissement-prealable-v1',
    'markovic-interdire-gavage-et-produits-importes-v1',
    'markovic-transport-duree-mammiferes-oiseaux-v1',
    'markovic-transport-maritime-commercial-animaux-v1',
    'markovic-transport-abattage-gestation-v1',
    'markovic-mutilations-elevage-v1',
    'markovic-interdire-races-elevage-hypertypes-v1',
    'saforcada-admettre-preuves-alternatives-paturages-aides-v1',
    'saforcada-contrats-filiere-proteines-locales-autonomie-elevage-v1',
    'saforcada-soutenir-abattoirs-ateliers-laiteries-territoriaux-v1',
    'groupe-rn-six-mois-reglementation-elevages-v1',
    'philippe-stop-surtransposition-normes-agricoles-v1',
    'delmur-interdire-elevage-sans-plein-air-v1',
    'delmur-reduire-production-elevage-deux-tiers-v1',
    'place-publique-sortie-elevage-cage-union-europeenne-v1',
    'place-publique-moderniser-abattoirs-et-experimenter-unites-mobiles-v1',
  ],
  'travail-demarches-entreprises': [
    'renaissance-creer-cent-territoires-dinnovation-beneficiant-de-regles-administratives-ac-v1',
    'renaissance-creer-un-interlocuteur-unique-pour-acceder-aux-aides-aux-entreprises-v1',
    'lisnard-caces-validite-et-pratique-v1',
    'lisnard-limiter-obligations-reporting-csrd-v1',
    'lisnard-reception-travaux-remplacement-capteurs-incendie-v1',
    'lisnard-visite-embauche-courts-contrats-sans-risque-v1',
    'retailleau-relever-seuil-50-a-100-salaries-v1',
    'retailleau-droit-erreur-entreprises-rectifier-v1',
    'herlin-facturation-electronique-obligatoire-v1',
    'dubuisson-droit-entreprises-sa-sas-v1',
    'dubuisson-guichet-entreprises-formalites-v1',
    'melenchon-outil-gratuit-facturation-electronique-pme-v1',
    'lepen-supprimer-normes-entreprises-par-ordonnances-v1',
    'lisnard-geler-normes-suspendre-surtranspositions-v1',
    'lisnard-etendre-procedures-simplifiees-grands-chantiers-v1',
    'tinland-alleger-fiscalite-entreprises-v1',
    'lisnard-guichet-numerique-agriculteurs-v2',
  ],
  'numerique-enseignement-numerique': [
    'polony-privilegier-education-face-a-tiktok-v1',
    'bouamrane-preserver-pensee-critique-usage-ia-ecole-v1',
    'roussel-congres-education-image-et-numerique-v1',
    'melenchon-developper-education-numerique-enfants-v1',
    'lisnard-former-eleves-usages-intelligence-artificielle-v1',
  ],
  'climat-eau-potable': [
    'place-publique-tarification-eau-aide-3-pourcent-v1',
    'lepen-outremer-plan-eau-infrastructures-v1',
    'asselineau-soutenir-acces-eau-guadeloupe-v1',
    'melenchon-installer-fontaines-douches-sanitaires-gratuits-v1',
    'melenchon-analyser-systematiquement-contaminants-eau-v1',
    'melenchon-gerer-eau-assainissement-en-regie-v1',
    'melenchon-financer-canalisations-eau-guadeloupe-v1',
    'melenchon-declencher-orsec-eau-plafonner-bouteilles-v1',
    'melenchon-ne-pas-repercuter-dette-eau-investissements-v1',
  ],
  'institutions-revocation-elus': [
    'asselineau-envisager-referendum-revocatoire-president-v1',
    'kazib-rendre-mandats-revocables-v1',
  ],
  'aide-ukraine': [
    'attal-nov28-saisir-avoirs-russes-geles-v1',
    'lalanne-cesser-envois-fonds-ukraine-v1',
  ],
  'europe-accord-mercosur': [
    'legendre-critiquer-accord-mercosur-v1',
    'lassalle-demander-opposition-france-mercosur-v1',
  ],
  'sante-experimentation-animale': [
    'place-publique-encadrer-utilisation-animaux-recherche-v1',
    'delmur-produits-testes-sur-animaux-v1',
    'markovic-independance-comites-ethique-experimentation-v1',
    'markovic-experimentations-inspections-inopinees-v1',
    'markovic-experimentations-objection-conscience-v1',
    'markovic-experimentations-productivite-interdiction-v1',
    'markovic-investir-recherche-remplacement-experimentation-animale-v1',
    'markovic-accelerer-validation-methodes-sans-animaux-v1',
    'markovic-renforcer-controle-procedures-experimentation-animale-v1',
  ],
  'institutions-voile-espace-public': [
    'collovati-signes-religieux-espace-public-v1',
    'arthaud-sopposer-interdiction-voile-espace-public-v1',
  ],
  'travail-automatisation-intelligence-artificielle': [
    'lalanne-consulter-population-remplacement-travail-ia-v1',
  ],
  'numerique-centres-de-calcul': [
    'rohou-planifier-grands-centres-donnees-parlement-v1',
    'rohou-suspendre-statut-projets-centres-donnees-rantigny-v1',
    'rohou-priorite-acteurs-francais-centres-donnees-v1',
    'rohou-raccordement-reseau-chaleur-centres-donnees-v1',
    'rohou-friches-pour-centres-donnees-v1',
    'rohou-technologies-ia-efficaces-energie-foncier-v1',
  ],
  'institutions-controle-depense-publique': [
    'place-publique-observatoire-integrite-publique-v1',
    'attal-nov28-responsabilite-budgetaire-gouvernement-v1',
    'retailleau-lois-cadres-plafonds-depenses-budget-v1',
    'retailleau-eteindre-programmes-grands-mal-evalues-v1',
    'retailleau-transfert-prive-activites-cinq-milliards-v1',
    'lepen-contre-budget-gestion-bons-tresor-v1',
    'pic-publier-evaluation-et-donnees-jalons-transition-v1',
    'dubuisson-suivi-open-data-contrats-publics-v1',
    'dubuisson-comites-suivi-reformes-v1',
  ],
  'institutions-liberte-medias': [
    'place-publique-creer-delit-desinformation-organisee-v1',
    'place-publique-taxer-geants-numeriques-financement-presse-v1',
    'zemmour-abroger-lois-pleven-gayssot-v1',
    'zemmour-retirer-droit-action-associations-liberte-expression-v1',
    'zemmour-reformer-loi-audiovisuel-pluralisme-v1',
    'zemmour-knafo-fin-subventions-presse-v1',
    'zemmour-privatiser-audiovisuel-public-v1',
    'asselineau-envisager-delit-dissimulation-information-v1',

    'bouamrane-refuser-exclusion-journalistes-presse-v1',
  ],
  'sante-aide-a-mourir': ['herlin-referendum-loi-euthanasie-v1'],
  'travail-conditions-aides-entreprises': [
    'melenchon-contreparties-aides-automobile-v1',
    'melenchon-aides-auto-85-pourcent-contenu-europeen-v1',
    'melenchon-contrats-cellules-batteries-aides-constructeurs-v1',
    'melenchon-subordonner-aides-batteries-transferts-technologie-v1',
    'place-publique-plafonner-credit-impot-recherche-grands-groupes-v1',
    'renaissance-privilegier-les-prises-de-participation-publiques-et-la-couverture-des-prem-v1',
    'renaissance-financer-des-projets-de-pme-et-deti-industrielles-par-un-fonds-territorial-v1',
    'lepen-outremer-soutenir-jeunes-entrepreneurs-v1',
    'labib-exiger-restitution-aides-publiques-grandes-entreprises-v1',
    'collovati-supprimer-subventions-entreprises-v1',
  ],
  'institutions-dissolution-assemblee': [
    'collovati-dissolution-assemblee-2027-v1',
  ],
  'europe-cooperations-industrielles': [
    'place-publique-label-epargne-entreprises-projets-europe-v1',
    'attal-nov28-relocaliser-productions-critiques-v1',
    'renaissance-creer-un-regime-juridique-europeen-utilisable-par-les-entreprises-dans-les-v1',
    'herlin-scaf-cooperation-alliance-v1',
  ],
  'institutions-finances-communes': [
    'retailleau-attribuer-tva-logements-neufs-communes-v1',
    'lepen-contre-budget-revoir-remboursement-fctva-v1',
    'lepen-contre-budget-rebudgetiser-tva-des-regions-et-epci-v1',
    'pic-impot-communal-unique-v1',
    'dubuisson-ressources-competences-transferees-v1',
  ],
  'institutions-controle-constitutionnel': [
    'retailleau-clause-sauvegarde-traites-v1',
    'tinland-tirage-conseil-constitutionnel-cinq-courants-v1',
  ],
  'institutions-duree-mandat-presidentiel': ['rohou-retablir-septennat-v1'],
  'social-revenus-et-prestations': [
    'place-publique-logistique-invendus-aide-alimentaire-v1',
    'place-publique-conference-minimum-social-unique-moins-25-ans-v1',
    'glucksmann-fonds-social-europeen-aide-alimentaire-5-pourcent-v1',
    'lisnard-verser-automatiquement-prestations-verifiables-v1',
    'retailleau-condition-constitutionnelle-cinq-ans-travail-v1',
    'lepen-maintenir-soutiens-restos-coeur-v1',
    'zemmour-knafo-retirer-aides-auteurs-delits-crimes-v1',
    'collovati-prestations-francais-v1',
    'labib-cesser-imposer-trois-jours-carence-maladie-v1',
  ],
  'sante-organisation-hospitaliere': [
    'place-publique-financement-global-pluriannuel-hopitaux-v1',
    'dubuisson-paiement-direct-medecins-v1',
    'delmur-medecine-complementaire-v1',
  ],
  'fiscalite-biens-et-credits-publics': [
    'zemmour-augmenter-budgets-justice-defense-v1',
    'lepen-contre-budget-affecter-tsca-services-incendie-v1',
    'collovati-train-de-vie-elysee-v1',
  ],
  'logement-hebergement-precaire': [
    'melenchon-10-mille-logements-hebergement-urgence-v1',
    'glucksmann-generaliser-logement-abord-sans-abri-v1',
    'zemmour-knafo-exclure-hebergement-urgence-etrangers-irreguliers-v1',
  ],
  'logement-foncier-et-quartiers': [
    'melenchon-prets-bonifies-bail-reel-solidaire-v1',
    'melenchon-credit-acquisition-clauses-antispeculatives-v1',
    'lisnard-confier-zan-intercommunalites-v1',
    'lisnard-rescrit-urbanisme-littoral-v1',
    'lisnard-relever-seuil-recours-architecte-250-v1',
    'lisnard-limiter-bornage-proximite-projet-v1',
    'lisnard-declarer-modifications-mineures-permis-v1',
    'lisnard-plafonner-contentieux-urbanisme-deux-ans-v1',
  ],
  'logement-performance-energetique': [
    'melenchon-renover-150-mille-logements-publics-v1',
    'melenchon-aide-renovation-100-pourcent-degressive-v1',
    'melenchon-canicules-volets-brasseurs-logements-publics-v1',
    'melenchon-remplacement-chaudieres-fioul-gaz-cadence-v1',
    'attal-nov28-simplifier-label-rge-artisans-v1',
    'lisnard-dpe-bonus-malus-location-v1',
    'lisnard-abf-faciliter-isolation-bati-ancien-v1',
  ],
  'climat-economie-circulaire': [
    'melenchon-reemploi-dechets-btp-commande-publique-v1',
    'melenchon-demontabilite-pieces-donnees-reparation-voitures-v1',
    'melenchon-droit-diagnostic-batteries-vehicules-v1',
    'melenchon-un-milliard-recyclage-batteries-v1',
    'melenchon-recyclage-pneus-rechapage-pyrolyse-v1',
    'melenchon-exigences-achat-vetements-entreprises-v1',
    'melenchon-bonus-malus-textile-au-dela-fast-fashion-v1',
    'melenchon-gestion-publique-filiere-dechets-textiles-v1',
    'melenchon-affichage-score-environnemental-vetements-plateformes-v1',
    'melenchon-doubler-duree-vie-vetements-v1',
    'melenchon-25-pourcent-textiles-reemployes-achats-publics-v1',
    'melenchon-tripler-ressources-eco-organismes-fonds-reemploi-v1',
    'melenchon-200-mille-tonnes-recyclage-habillement-boucle-fermee-v1',
    'melenchon-collecte-tri-textile-soutien-par-tonne-v1',
    'retailleau-differencier-contributions-recyclage-batiment-v1',
  ],
  'institutions-protection-patrimoine': [
    'melenchon-doubler-budget-entretien-monuments-v1',
  ],
  'travail-industrie-et-innovation': [
    'melenchon-reconvertir-usines-moteurs-electrique-v1',
    'melenchon-appels-projets-lignes-automobiles-v1',
    'melenchon-moratoire-fermetures-sites-auto-v1',
    'melenchon-4-milliards-fonds-sous-traitants-auto-v1',
    'melenchon-capacite-batteries-100-gwh-v1',
    'melenchon-60-millions-filiere-lin-chanvre-france-2030-v1',
    'melenchon-contrats-pluriannuels-cultivateurs-transformateurs-textile-v1',
    'melenchon-prets-bancaires-sites-confection-textile-v1',
    'melenchon-plateforme-en-ligne-vetement-francais-v1',
    'melenchon-locaux-a-loyer-modere-reparateurs-textiles-v1',
    'melenchon-relancer-linge-hospitalier-textiles-collectifs-v1',
    'melenchon-10-millions-recherche-textiles-techniques-v1',
    'melenchon-guichet-innovation-rejets-eau-textile-v1',
    'place-publique-creer-fonds-regionaux-capital-entreprises-v1',
    'place-publique-indice-achat-local-commande-publique-v1',
    'place-publique-investir-equipements-sobres-reparables-v1',
    'place-publique-mines-raffineries-metaux-critiques-v1',
    'lepen-outremer-attirer-concurrents-monopoles-v1',
  ],
  'climat-mobilite-collective': [
    'melenchon-minibus-autonomes-recherche-deploiement-v1',
    'place-publique-moratoire-projets-routiers-affecter-peages-v1',
    'place-publique-doubler-trajets-velo-dix-ans-v1',
    'lepen-trajets-train-gratuits-jeunes-heures-creuses-v1',
  ],
  'climat-agriculture-ecologie': [
    'melenchon-lin-40-mille-hectares-additionnels-bio-v1',
    'melenchon-65-mille-hectares-chanvre-2032-v1',
    'place-publique-revenu-transition-agriculteurs-pecheurs-v1',
    'place-publique-zones-sans-pesticides-captages-ecoles-v1',
    'lisnard-fusion-declarations-viticoles-pac-v1',
    'lisnard-derogation-pac-secheresse-v1',
    'lisnard-aligner-zones-non-traitement-et-vente-conseil-v1',
  ],
  'travail-commande-publique': [
    'melenchon-ecocriteres-commande-publique-habillement-v1',
    'attal-nov28-commande-publique-plutot-que-subventions-v1',
    'retailleau-verser-automatiquement-interets-moratoires-public-v1',
    'lepen-outremer-commande-publique-locale-v1',
  ],
  'sante-prevention': [
    'melenchon-interdire-vetements-substances-dangereuses-v1',
    'place-publique-financement-prevention-sante-hors-ondam-annuel-v1',
    'lisnard-supprimer-certificat-sport-loisir-v1',
    'lepen-associer-buralistes-regles-vape-v1',
  ],
  'securite-enquetes-et-trafics': [
    'place-publique-brigades-cyber-sentinelle-v1',
    'philippe-nov28-ecarter-lenvoi-de-larmee-dans-les-quartiers-pour-lutter-contre-le-narcotraf-v1',
    'lisnard-creer-delit-de-pillage-v1',
    'lepen-outremer-lutter-narcotrafic-v1',
    'lepen-fermetures-administratives-vente-tabac-contrebande-v1',
    'lepen-sanctions-trafic-tabac-v1',
  ],
  'europe-defense-moyens': [
    'place-publique-renforcer-reserve-operationnelle-v1',
    'place-publique-pilotage-europeen-production-exportations-defense-v1',
    'attal-nov28-bouclier-antimissile-parapluie-nucleaire-v1',
    'philippe-nov28-fixer-un-objectif-dau-moins-18-fregates-pour-la-marine-v1',
    'lepen-outremer-base-interarmees-noumea-v1',
    'lepen-proteger-infrastructures-face-actions-hybrides-v1',
    'lepen-reponse-proportionnee-operations-hostiles-v1',
  ],
  'climat-sources-electricite': [
    'place-publique-investir-reseau-stockage-electrique-v1',
  ],
  'europe-negociation-ukraine': [
    'place-publique-interdire-importations-gaz-russe-v1',
    'zemmour-france-mediateur-russie-ukraine-v1',
  ],
  'institutions-demarches-et-recours': [
    'place-publique-investissements-ia-services-publics-v1',
    'lisnard-attestation-nationalite-cni-passeport-v1',
    'lisnard-silence-vaut-accord-delais-opposables-v1',
    'lisnard-interets-retards-remboursements-etat-v1',
    'lisnard-droit-erreur-avertir-premier-manquement-v1',
    'lisnard-limiter-huissier-petits-retards-v1',
    'lisnard-indemniser-erreurs-administration-v1',
    'lisnard-mediateur-dossiers-bloques-cinq-ans-v1',
  ],
  'education-financement-des-etudes': [
    'place-publique-visas-bourses-chercheurs-menaces-v1',
    'place-publique-aide-eloignement-etudes-formations-delocalisees-v1',
    'place-publique-capital-formation-universel-v1',
    'renaissance-donner-aux-jeunes-un-capital-de-reprise-detudes-via-le-cpf-v1',
    'renaissance-fusionner-la-bourse-etudiante-et-laide-au-logement-dans-un-versement-unique-v1',
    'retailleau-developper-internats-prepas-v1',
    'zemmour-knafo-frais-etudes-etudiants-etrangers-v1',
  ],
  'climat-pilotage-transition': [
    'place-publique-conventions-climat-locales-v1',
    'place-publique-repertoire-aides-produits-ecologiques-v1',
    'zemmour-knafo-supprimer-ademe-v1',
  ],
  'climat-risques-naturels': [
    'place-publique-interdire-nouvelles-grandes-surfaces-v1',
    'place-publique-garantie-universelle-assurance-climatique-v1',
    'lisnard-reviser-plans-inondation-adaptes-v1',
    'lepen-mayotte-reconstruction-indemnisation-chido-v1',
  ],
  'climat-transports-marchandises': [
    'place-publique-connecter-ports-autoroutes-ferroviaires-v1',
  ],
  'climat-condition-animale': [
    'place-publique-plan-animaux-compagnie-tracabilite-v1',
    'place-publique-interdire-elevage-fourrure-europe-v1',
    'lisnard-harmoniser-ovosexage-europe-v1',
  ],
  'climat-peche-aquaculture': [
    'place-publique-repartir-quotas-peche-artisanale-v1',
  ],
  'climat-protection-biodiversite': [
    'place-publique-encadrer-achats-forets-financiers-v1',
  ],
  'travail-cotisations-salaires': [
    'place-publique-indexer-point-indice-fonction-publique-inflation-v1',
    'retailleau-refondre-forfait-social-v1',
  ],
  'travail-representation': [
    'place-publique-administrateurs-salaries-des-100-v1',
    'place-publique-cheque-syndical-v1',
    'place-publique-priorite-accords-branche-v1',
    'retailleau-ouvrir-conclusion-accords-cse-referendum-v1',
    'zemmour-knafo-fin-subventions-syndicats-v1',
  ],
  'travail-acces-emploi': [
    'place-publique-cdi-insertion-harmonise-v1',
    'place-publique-guichet-territorial-france-travail-v1',
    'zemmour-knafo-retirer-mission-placement-france-travail-v1',
  ],
  'institutions-competences-territoires': [
    'place-publique-elire-conseils-communautaires-suffrage-direct-v1',
    'zemmour-fusionner-departements-regions-provinces-v1',
    'zemmour-knafo-supprimer-cese-ceser-v1',
  ],
  'institutions-conseil-prive-etat': [
    'place-publique-encadrer-externalisation-etat-cabinets-conseil-v1',
  ],
  'social-handicap-et-autonomie': [
    'place-publique-indemnisation-aidants-familiaux-activite-reduite-v1',
    'renaissance-inclure-une-garantie-dependance-dans-les-contrats-de-complementaire-sante-r-v1',
    'lisnard-mdph-droit-permanent-handicap-definitif-v1',
    'lisnard-demarches-mairie-handicap-a-domicile-v1',
    'retailleau-avancer-credit-impot-adapter-logement-vieillissement-v1',
  ],
  'social-droits-familles-enfants': [
    'place-publique-controle-independant-departements-protection-enfance-v1',
    'place-publique-fonds-publics-protection-enfance-sans-lucrativite-v1',
    'renaissance-elargir-les-ordonnances-de-protection-aux-enfants-victimes-de-violences-fam-v1',
    'lepen-renforcer-contradictoire-placement-enfants-v1',
    'lepen-reduire-changements-enfants-places-v1',
  ],
  'securite-police-et-controle': [
    'place-publique-equipes-mobiles-prevention-delinquance-v1',
    'renaissance-employer-en-priorite-les-reservistes-de-police-et-de-gendarmerie-pour-les-p-v1',
    'renaissance-elargir-les-competences-judiciaires-des-polices-municipales-v1',
    'renaissance-faire-de-la-police-municipale-la-regle-au-dela-de-10-000-habitants-v1',
    'renaissance-fixer-un-equipement-minimal-pour-les-polices-municipales-selon-la-taille-de-v1',
    'renaissance-creer-une-ecole-nationale-des-policiers-municipaux-avec-des-antennes-region-v1',
    'renaissance-encourager-les-polices-municipales-et-les-centres-de-surveillance-intercomm-v1',
    'renaissance-etendre-les-permanences-et-brigades-mobiles-de-gendarmerie-dans-les-village-v1',
    'lisnard-revaloriser-financierement-enqueteurs-v1',
    'lisnard-confier-taches-administratives-police-civils-v1',
    'lepen-police-municipale-trafic-tabac-v1',
  ],
  'securite-cannabis': [
    'place-publique-convention-citoyenne-politique-drogues-v1',
  ],
  'securite-detention-et-peines': [
    'place-publique-developper-justice-restaurative-tig-v1',
    'attal-nov28-supprimer-juge-application-peines-v1',
    'attal-nov28-suppression-juge-application-peines-v1',
    'renaissance-executer-les-travaux-dinteret-general-dans-un-delai-maximal-de-trois-mois-v1',
    'renaissance-privilegier-la-detention-a-domicile-pour-certaines-premieres-condamnations-v1',
    'retailleau-supprimer-fonction-juge-application-peines-v1',
    'retailleau-supprimer-amenagements-automatiques-prison-v1',
  ],
  'institutions-services-outre-mer': [
    'place-publique-flecher-octroi-mer-investissement-local-v1',
    'lepen-outremer-aller-retour-hexagone-v1',
    'lepen-outremer-conseil-interministeriel-v1',
    'lepen-outremer-ministere-domaine-maritime-v1',
    'lepen-outremer-majorer-effort-etat-v1',
  ],
  'education-vie-scolaire': [
    'place-publique-allocation-temps-formation-continue-educateurs-v1',
    'retailleau-fin-repartition-postes-public-prive-80-20-v1',
    'retailleau-liberte-instruction-famille-six-ans-v1',
    'lisnard-accueillir-eleves-perturbateurs-etablissements-disciplinaires-v1',
    'zemmour-renforcer-pouvoir-disciplinaire-etablissements-v1',
    'zemmour-financer-public-et-prive-selon-eleves-v1',
  ],
  'education-sport': [
    'place-publique-exonerer-premier-contrat-pro-sportives-parasport-v1',
  ],
  'securite-lutte-racisme': [
    'place-publique-discriminations-formation-professions-service-public-v1',
  ],
  'immigration-accueil-integration': [
    'place-publique-guichets-uniques-primo-arrivants-v1',
    'philippe-nov28-organiser-lintegration-autour-de-la-langue-francaise-du-travail-et-des-prin-v1',
  ],
  'immigration-entree-sejour': [
    'place-publique-faire-carte-sejour-pluriannuelle-titre-reference-v1',
    'philippe-nov28-suspendre-les-nouvelles-demandes-dasile-en-cas-de-pression-dun-etat-etrange-v1',
    'philippe-nov28-renegocier-les-accords-du-touquet-et-les-denoncer-en-cas-dechec-v1',
    'retailleau-mariage-subordonner-sejour-regulier-v1',
    'retailleau-frontiere-scanners-ia-fichiers-v1',
    'retailleau-supprimer-jour-franc-frontiere-v1',
    'zemmour-ne-pas-renouveler-titres-sejour-apres-condamnation-v1',
    'zemmour-knafo-augmenter-cout-visas-v1',
  ],
  'europe-solidarite-internationale': [
    'place-publique-fonds-europeen-organisations-feministes-v1',
  ],
  'institutions-associations-et-libertes': [
    'glucksmann-guichet-unique-demarches-associations-v1',
    'lepen-subventions-associations-apolitiques-v1',
    'zemmour-knafo-fin-subventions-associations-politisees-v1',
  ],
  'education-enseignements': [
    'attal-nov28-amenager-cours-college-v1',
    'retailleau-niveaux-mathematiques-lycee-v1',
    'retailleau-economie-enseignement-des-seconde-v1',
    'retailleau-quinze-minutes-lecture-par-jour-v1',
    'retailleau-reaffecter-heures-educations-transversales-v1',
    'zemmour-lecture-methode-syllabique-v1',
  ],
  'travail-agents-publics': [
    'attal-nov28-recruter-professeurs-secteur-prive-v1',
    'retailleau-non-remplacement-400000-departs-v1',
  ],
  'securite-organisation-justice': [
    'attal-nov28-reecrire-code-procedure-penale-v1',
    'attal-nov28-reformer-conseil-superieur-magistrature-v1',
    'renaissance-creer-une-procedure-de-reconnaissance-de-culpabilite-en-matiere-criminelle-v1',
    'zemmour-reformer-ecole-nationale-magistrature-v1',
    'zemmour-knafo-aide-juridictionnelle-nationalite-v1',
    'lepen-contre-budget-augmenter-ticket-moderateur-justice-v1',
    'lepen-aggraver-peines-recel-secret-enquete-v1',
  ],
  'securite-condition-animale': [
    'attal-nov28-sanctions-animaleries-appliquees-v1',
    'attal-nov28-supprimer-salons-du-chiot-v1',
  ],
  'education-rythmes-scolaires': ['attal-nov28-revoir-journees-scolaires-v1'],
  'institutions-haute-administration': [
    'attal-nov28-moins-d-echelons-chefs-de-terrain-v1',
    'lisnard-responsable-performance-premier-ministre-v1',
    'lisnard-revue-ministerielle-quarante-cinq-jours-v1',
    'lisnard-drh-et-fonctions-transformation-ministeres-v1',
    'zemmour-gouvernement-dix-ministeres-v1',
    'zemmour-knafo-ia-fonctions-administratives-v1',
  ],
  'institutions-representation-publique': [
    'attal-nov28-trois-cent-cinquante-deputes-v1',
    'renaissance-consacrer-10-du-temps-parlementaire-a-la-simplification-legislative-v1',
  ],
  'institutions-service-civique-obligatoire': [
    'attal-nov28-mois-engagement-civique-jeunes-v1',
  ],
  'numerique-reseaux-sociaux-identification': [
    'attal-nov28-reseaux-sociaux-moins-de-quinze-ans-v1',
    'zemmour-preserver-anonymat-internet-v1',
  ],
  'logement-attribution-nationalite': [
    'attal-lci-privilegier-le-travail-dans-les-services-essentiels-pour-lattribution-de-no-v1',
  ],
  'securite-surveillance-et-urgence': [
    'renaissance-etendre-lexperimentation-de-videoprotection-algorithmique-des-jeux-olympiqu-v1',
    'lisnard-maintenir-accompagnement-parents-vigipirate-v1',
    'lisnard-drones-identifier-auteurs-violences-v1',
  ],
  'education-acces-culture': [
    'renaissance-prevoir-deux-visites-de-lieux-de-memoire-pendant-la-scolarite-v1',
  ],
  'travail-conges-evenements-familiaux': [
    'renaissance-instaurer-un-conge-de-naissance-de-six-mois-mieux-remunere-v1',
  ],
  'travail-egalite-professionnelle': [
    'renaissance-imposer-la-transparence-des-salaires-dans-les-offres-demploi-v1',
  ],
  'fiscalite-entreprises': [
    'lisnard-creation-entreprise-cfe-cotisations-an-v1',
    'retailleau-supprimer-c3s-v1',
    'retailleau-supprimer-cvae-definitivement-v1',
    'retailleau-exonerer-cfe-part-industrielle-v1',
  ],
  'fiscalite-patrimoine-et-revenus': [
    'lisnard-ifi-imposition-valeur-usufruit-v1',
    'lisnard-interets-faibles-seuil-declaration-v1',
    'lepen-controle-transmission-baisse-tva-v1',
  ],
  'immigration-eloignement': [
    'retailleau-expulsion-obligatoire-condamnes-menace-v1',
    'lisnard-conditionner-cooperation-readmission-algerie-v1',
    'lepen-outremer-aide-comores-readmission-v1',
    'zemmour-executer-cent-pour-cent-oqtf-v1',
    'zemmour-objectif-deux-millions-etrangers-en-moins-v1',
  ],
  'fiscalite-commerce': [
    'retailleau-opposer-ukraine-marche-agricole-v1',
    'lepen-outremer-exception-agricole-accords-commerciaux-v1',
    'lepen-outremer-clauses-miroirs-agricoles-v1',
    'zemmour-droits-douane-automobiles-chinoises-50-v1',
    'zemmour-maintenir-libre-echange-loyal-etats-unis-v1',
  ],
  'immigration-nationalite': [
    'zemmour-decheance-nationalite-binationaux-crimes-v1',
    'lepen-renoncer-interdiction-binationalite-v1',
  ],
};
const scopedComplements: Record<string, Record<string, string>> = {
  'climat-restrictions-publicite': {
    'billetdoux-interdire-taxer-certaines-pratiques-publicites-v2':
      'Augustin Billetdoux évoque l’interdiction de certaines publicités. Il ne précise pas celles qui seraient visées.',
  },
  'social-garde-jeunes-enfants': {
    'melenchon-revaloriser-salaires-personnels-creches-v1':
      'Jean-Luc Mélenchon propose de mieux rémunérer le personnel pour pouvoir recruter et ouvrir des places.',
  },
  'numerique-identite-numerique': {
    'philippot-exclure-donnees-sante-identite-numerique-v1':
      'Le passage vise les catégories de données qu’un système d’identité numérique pourrait contenir.',
  },
  'agriculture-cantines': {
    'polony-education-gout-cantines-v1':
      'Le passage porte sur les activités d’éducation au goût. Le financement des repas et les règles d’achat restent à préciser.',
  },
  'agriculture-remuneration-contrats': {
    'polony-commande-production-v2':
      'La priorité dans les achats publics vise à garantir des débouchés aux producteurs. Le prix payé aux exploitations reste à préciser.',
  },
  'education-acces-etudes': {
    'attal-nov28-parcoursup-outil-accompagnement-v1':
      'Le candidat maintient Parcoursup et propose d’améliorer l’accompagnement en amont des candidatures.',
    'labib-creer-places-universite-recrutements-batiments-v1':
      'Augmenter les capacités d’accueil agit sur le nombre de places disponibles.',
    'bouamrane-renforcer-orientation-reorientation-lycee-v1':
      'Karim Bouamrane demande de revoir l’accompagnement des lycéens. Son intervention ne fixe pas de procédure d’admission.',
    'melenchon-rendre-gratuites-etudes-superieures-licence-doctorat-v1':
      'La mesure change les conditions financières d’accès aux études. Elle ne prévoit pas de règle d’admission.',
    'labib-sopposer-selection-parcoursup-v1':
      'Selma Labib s’oppose à la sélection dans Parcoursup. Elle ne précise pas quelles règles d’admission lui succéderaient.',
    'polony-evaluations-nationales-certifications-anonymes-v1':
      'Les évaluations visent à aider les élèves à situer leur niveau. Le rôle de ces résultats dans les admissions reste à préciser.',
    'polony-reorganiser-filieres-insertion-v1':
      'La proposition porte sur l’offre de formations. Les règles de sélection des candidats sont traitées dans sa proposition sur Parcoursup.',
  },
  'agriculture-elevages': {
    'lassalle-evoquer-polyculture-diversifier-fermes-v1':
      'Jean Lassalle cite la polyculture comme une piste de diversification des exploitations. Il ne propose aucune nouvelle règle pour les élevages.',
    'markovic-reorienter-aides-publiques-cultures-vegetales-v1':
      'Dans le cadre de la sortie de l’élevage intensif, Mira Markovic propose de réorienter les aides publiques vers les cultures végétales destinées directement à l’alimentation humaine. Le discours ne fixe pas de règles nouvelles pour les exploitations d’élevage.',
    'markovic-parti-refuser-traite-ue-mercosur-v1':
      'Le Parti animaliste prend position sur les importations et l’accord commercial. Les règles pour les élevages français sont exposées dans d’autres fiches.',
    'markovic-parti-encadrer-plus-strictement-transport-animaux-v1':
      'Le Parti animaliste entend durcir l’encadrement du transport des animaux. Les règles à changer restent à préciser.',
    'markovic-parti-prioriser-productions-vegetales-alimentation-humaine-v1':
      'Le communiqué propose de privilégier les productions végétales destinées à l’alimentation humaine. Il ne précise pas de nouvelles règles pour les exploitations d’élevage.',
    'saforcada-exiger-reciprocite-methodes-production-importations-agricoles-v1':
      'Cette clause viserait les conditions de production des biens importés. Le passage ne modifie pas directement les règles des élevages en France.',
    'lisnard-mercosur-exclure-elevage-ou-clause-miroir-v1':
      'La proposition porte sur l’accord commercial avec le Mercosur et les conditions d’importation. Elle ne précise pas les règles d’exploitation des élevages français.',
  },
  'handicap-accompagnement-ecole': {
    'lisnard-developper-ulis-v1':
      'Le développement des unités d’inclusion scolaire concerne l’organisation de l’enseignement. Le passage ne précise pas le statut des accompagnants.',
  },
  'education-eleves-par-classe': {
    'lisnard-classes-rurales-plusieurs-niveaux-v1':
      'Le texte propose de regrouper plusieurs niveaux dans les classes rurales. Il ne fixe pas de nombre maximal d’élèves.',
  },
  'climat-production-nucleaire': {
    'lepen-renegocier-prix-electricite-europe-v3':
      'Le tract prend pour base la production nucléaire et hydraulique française pour fixer le prix intérieur de l’électricité.',
    'lepen-relancer-euratom-reacteurs-francais-v1':
      'La proposition porte sur la construction de réacteurs français dans les pays européens. Le passage ne fixe pas de capacité de production supplémentaire en France.',
  },
  'travail-salaire-minimum': {
    'philippe-nov28-accelerer-lalignement-du-smic-de-mayotte-sur-celui-de-lhexagone-v1':
      'La réforme du minimum salarial concerne spécifiquement Mayotte.',
    'labib-parti-plancher-revenus-2200-octobre-v1':
      'La revendication porte sur tout revenu. Le communiqué ne fixe ni salaire horaire ni référence au SMIC.',
    'lisnard-exoneration-emploi-domicile-smic-v1':
      'L’exonération concerne les charges de l’employeur à domicile lorsque le salarié est payé au SMIC.',
    'lisnard-baisser-csg-revenus-activite-66-v1':
      'La baisse de CSG viserait les revenus d’activité, dont les salaires au SMIC. La mesure ne modifie pas le salaire minimum.',
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
    'asselineau-consulter-francais-referendum-soutien-ukraine-v1':
      'François Asselineau envisage de faire décider les électeurs par référendum. Le passage documente le mode de décision proposé.',
    'riner-contester-envoi-militaires-francais-ukraine-v1':
      'La déclaration concerne l’envoi de militaires français en Ukraine. Elle ne précise pas le sort de l’aide matérielle ou financière.',
    'arthaud-contester-livraisons-armes-ukraine-v1':
      'Nathalie Arthaud conteste la justification des livraisons d’armes françaises à l’Ukraine. Le discours ne détaille pas sa position sur les autres formes d’aide.',
    'melenchon-negocier-cessez-feu-retrait-russe-ukraine-v1':
      'Cette proposition expose les objectifs de négociation et les garanties de paix recherchées. Le passage ne définit aucun volume d’aide française.',
    'melenchon-reconvoquer-conference-paris-osce-apres-paix-ukraine-v1':
      'Le projet concerne l’architecture de sécurité européenne une fois la paix revenue en Ukraine.',
    'philippe-soutenir-ladhesion-de-lukraine-a-lotan-v1':
      'L’adhésion à l’OTAN est un volet distinct du soutien envisagé. La proposition ne précise pas le contenu de l’aide française.',
    'riner-interroger-consequences-aide-ukraine-v2':
      'Teddy Riner dit que la France resterait aux côtés des pays opprimés. Dans cet échange, il renvoie à son futur programme pour les modalités de l’aide.',
  },
  'france-otan': {
    'durif-inviter-brics-et-otan-gouvernance-paix-v1':
      'L’invitation à discuter porte sur un cadre diplomatique mondial. Le retrait de l’alliance est décrit dans une autre fiche.',
    'melenchon-refuser-alliance-militaire-permanente-asie-pacifique-v1':
      'La proposition porte sur la politique d’alliances au-delà de l’OTAN. Le retrait français de l’Alliance est traité dans une autre fiche du programme.',
    'glucksmann-otan-garantie-securite-autonomie-europeenne-v1':
      'La lettre de février 2025 discute la crédibilité de la garantie américaine. Elle ne demande pas de changement du statut de la France dans l’Alliance.',
    'philippe-soutenir-ladhesion-de-lukraine-a-lotan-v1':
      'Le volet défense soutient l’adhésion de l’Ukraine à l’Alliance. Ce passage ne se prononce pas sur le commandement intégré français.',
  },
  'retraites-financement-regimes': {
    'philippe-nov28-ecarter-une-hausse-des-cotisations-dans-la-reforme-des-retraites-v1':
      'L’engagement concerne le taux des cotisations de retraite et complète la position sur les modalités de financement.',
    'dubuisson-capitalisation-dans-modele-paie-v1':
      'Le prélèvement de 10 % figure dans une simulation de paie. Le document ne fixe pas le régime applicable à l’ensemble des revenus.',
  },
  'travail-duree-travail': {
    'arthaud-reduire-journees-cadences-canicule-v1':
      'Cette demande porte sur la journée pendant les périodes de fortes chaleurs, sans fixer une nouvelle durée hebdomadaire.',
    'groupe-rn-appliquer-35-heures-fonction-publique-territoriale-v1':
      'Cette disposition du contre-budget vise la fonction publique territoriale. La durée légale pour les autres salariés n’est pas traitée dans ce passage.',
  },
  'parents-isoles': {
    'tinland-soutien-financier-familles-v1':
      'La mesure ciblée sur les parents isolés en difficulté concerne la protection maternelle et infantile à domicile.',
  },
  'numerique-demarches-en-ligne': {
    'renaissance-permettre-aux-victimes-de-suivre-leur-plainte-en-ligne-jusquau-jugement-v1':
      'Le suivi en ligne intervient une fois la plainte déposée, jusqu’au jugement.',
    'lisnard-guichet-ia-dossiers-urgents-v1':
      'Le dispositif proposé concerne le tri des dossiers urgents.',
    'philippe-deployer-un-plan-dutilisation-de-lia-dans-les-services-publics-v2':
      'Le projet prévoit de traiter certaines démarches simples avec l’IA. Le passage ne précise pas le canal de dépôt pour les usagers.',
    'place-publique-automatiser-acces-droits-dossier-social-unique-v1':
      'Le dossier social vise à ouvrir automatiquement certains droits. Le passage prévoit aussi des guichets physiques et ne décrit pas de procédure de dépôt en ligne.',
  },
  'sante-remboursement-soins': {
    'renaissance-rendre-obligatoire-la-complementaire-sante-des-salaries-de-particuliers-emp-v1':
      'La couverture complémentaire deviendrait obligatoire pour les salariés de particuliers employeurs.',
    'dubuisson-caisse-nationale-unique-sante-v1':
      'La proposition réorganise le circuit de remboursement, de la prescription au paiement.',
    'lisnard-libre-choix-assurance-panier-soins-v1':
      'Le candidat décrit une obligation de prise en charge et le choix de l’assureur. La composition du panier et les taux remboursés restent à préciser.',
  },
  'logement-obligations-parc-social': {
    'philippe-donner-aux-maires-la-decision-sur-lencadrement-des-loyers-v1':
      'Le volet logement transfère l’attribution des logements sociaux aux maires. Il ne donne pas de seuil de construction obligatoire.',
    'place-publique-rehausser-objectifs-logements-sociaux-v1':
      'Le projet prévoit des objectifs nationaux et des contrats territoriaux. Le passage ne fixe pas de nouveau quota légal par commune.',
  },
  'places-prison': {
    'roussel-congres-amenager-peines-et-suivre-probation-v1':
      'Le texte propose d’agir sur la surpopulation par l’aménagement des peines et le suivi en probation. Il ne se prononce pas ici sur la construction de places.',
    'melenchon-regulation-carcerale-contraignante-v1':
      'Le programme prévoit un autre levier pour réduire la surpopulation, la régulation carcérale. Ce passage ne tranche pas la construction de nouveaux établissements.',
  },
  'retraites-penibilite': {
    'attal-lci-tenir-compte-de-la-penibilite-et-de-leducation-des-enfants-dans-la-duree-de-v1':
      'La pénibilité entrerait dans le calcul de la durée cotisée dans un système sans âge légal. Le nombre de trimestres reste à préciser.',
    'riner-penibilite-reforme-retraites-v1':
      'Teddy Riner veut tenir compte de la pénibilité. Son entretien ne fixe ni critères ni âge de départ.',
    'melenchon-penibilite-travail-contraintes-retraite-v1':
      'Le plan santé précise les contraintes à retenir pour calculer les droits à la retraite. Il ne définit pas les conditions d’âge d’un départ anticipé.',
    'melenchon-reconnaitre-penibilite-metiers-feminises-v1':
      'Le plan féministe énumère les facteurs à prendre en compte pour les métiers majoritairement exercés par des femmes. L’effet sur l’âge de départ n’est pas précisé.',
    'lepen-preserver-carrieres-longues-plus-favorables-v1':
      'Le passage prévoit de conserver le dispositif des carrières longues quand il est plus favorable. Les critères d’un départ propre aux métiers pénibles ne sont pas détaillés.',
    'tinland-taux-plein-55-60-v1':
      'Le chapitre annonce des aménagements pour les métiers les plus pénibles. Il ne donne pas l’âge ni les critères propres à ces départs.',
  },
  'climat-avenir-eolien': {
    'saforcada-plan-autonomie-energetique-par-territoire-outre-mer-v1':
      'L’éolien flottant figure parmi les moyens envisagés selon la situation de chaque territoire.',
    'rohou-distance-dix-hauteurs-eoliennes-terrestres-v1':
      'La règle porte sur la distance d’implantation des éoliennes terrestres. Le document ne fixe pas de capacité à installer.',
    'zemmour-supprimer-subventions-eoliennes-v1':
      'Éric Zemmour veut retirer le soutien financier aux éoliennes. Il ne précise pas le sort des autorisations de nouveaux parcs dans ce passage.',
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
    'markovic-inscrire-protection-animaux-constitution-v1':
      'Mira Markovic propose d’inscrire la protection animale dans la Constitution. Le discours ne précise pas qui conduirait la révision ni selon quelle procédure.',
    'mlekuz-autoriser-constituante-proposer-lois-reglements-v1':
      'Le livre blanc définit aussi le pouvoir de l’assemblée de proposer les textes nécessaires au fonctionnement du nouveau régime.',
    'mathieu-demissionner-organiser-nouvelles-elections-apres-transition-v1':
      'La démission et les nouvelles élections sont prévues après la rédaction du texte et son approbation.',
    'asselineau-referendum-dispositions-constitutionnelles-sortie-ue-v1':
      'Le candidat propose un vote sur des dispositions constitutionnelles concernant l’Union européenne, dans le cadre des négociations de retrait.',
    'mathieu-consultations-territoires-v1':
      'Le candidat prévoit des contributions du public aux travaux. La composition de la convention est documentée dans une fiche distincte.',
  },
  'statuts-outre-mer': {
    'lepen-outremer-priorite-economie-avant-statuts-v1':
      'Le passage fixe une priorité économique et sociale. Il ne donne pas la procédure permettant de choisir un statut.',
    'place-publique-reprendre-dialogue-nouvelle-caledonie-v1':
      'Le mouvement demande de reprendre le dialogue politique en Nouvelle-Calédonie. Le texte ne fixe pas la procédure de révision du statut.',
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
    'lepen-contester-regroupement-familial-octobre-2026-v1':
      'La candidate met en cause la charge du dispositif. Elle ne précise pas dans cet échange ce qu’elle changerait dans ses conditions.',
  },
  'sante-aide-a-mourir': {
    'asselineau-consulter-francais-referendum-euthanasie-v1':
      'François Asselineau évoque un référendum. Le passage documente une consultation des électeurs.',
    'attal-soutenir-le-droit-a-l-aide-a-mourir-v1':
      'Gabriel Attal soutient le texte lors de son adoption définitive et annonce sa mise en œuvre. La déclaration précède la promulgation de la loi.',
    'melenchon-constitutionnaliser-droit-mourir-dignite-v1':
      'Le programme propose une garantie constitutionnelle. Le passage ne détaille pas les articles de la loi en vigueur qu’il faudrait modifier.',
    'lisnard-prioriser-soins-palliatifs-2025-v1':
      'L’entretien date de janvier 2025 et précède l’adoption de la loi du 18 août 2026. Il documente une position dans le débat antérieur.',
    'saforcada-referendum-fin-de-vie-v1':
      'David Saforcada propose un débat et un référendum sur la fin de vie. La charte n’indique pas quelle modification apporter à la loi.',
  },
  'mobilite-territoires': {
    'attal-nov28-leasing-electrique-premiere-ligne-v1':
      'Le leasing viserait les travailleurs de première ligne, dont les besoins de déplacement dépassent les seules zones rurales.',
    'philippe-developper-ferroviaire-reunion-guyane-v1':
      'Cette position vise deux territoires ultramarins. Le passage ne fixe ni dessertes ni modalités de financement.',
    'saforcada-plafonner-tarifs-continuite-territoriale-outre-mer-v1':
      'Les liaisons entre îles et communes isolées sont visées dans le cadre ultramarin.',
    'polony-soutenir-fret-ferroviaire-dessertes-territoires-v1':
      'Cette prise de parole souligne la dégradation des liaisons ferroviaires avec Paris et du fret. Aucun nouveau service local n’est annoncé.',
    'batho-reduire-dependance-voiture-v1':
      'La candidate prévoit des investissements pour réduire la dépendance à la voiture. Le volet ne choisit pas de service local de transport à développer.',
  },
  'soins-de-proximite': {
    'labib-defendre-acces-effectif-ivg-v1':
      'Selma Labib cite le manque de médecins en zone rurale parmi les obstacles à l’accès à l’IVG. L’entretien ne précise pas où seraient implantés de nouveaux services.',
    'saforcada-relier-maisons-sport-sante-soins-clubs-v1':
      'Le réseau orienterait vers une activité physique adaptée proche ou mobile, en lien avec les professionnels de santé.',
    'dubuisson-dossier-medical-pros-autorises-v1':
      'La proposition concerne le partage des informations entre les professionnels qui interviennent dans les soins.',
  },
  'institutions-declenchement-referendum': {
    'attal-nov28-reforme-institutionnelle-referendum-v1':
      'La proposition prévoit de soumettre au vote une réforme institutionnelle portée par l’exécutif.',
    'asselineau-referendum-sanctions-et-securite-v1':
      'Le référendum envisagé porterait sur la justice et la sécurité. Le passage décrit le sujet de la consultation.',
    'labib-decisions-travailleurs-assemblees-generales-v1':
      'Selma Labib défend les assemblées générales de travailleurs. Elle juge insuffisant le RIC constituant proposé par Clara Egger pour leur donner le pouvoir de décision dans le système économique actuel.',
    'rohou-ric-local-environnemental-v1':
      'Le projet porte sur les référendums locaux en matière environnementale. Le seuil de 5 % des inscrits est donné à titre d’exemple.',
    'philippe-fiscalite-2-v4':
      'Le candidat prévoit de soumettre la règle d’or budgétaire au vote au début du quinquennat. Ce volet ne propose pas de modifier les règles de déclenchement du référendum.',
    'lepen-recourir-au-referendum-expression-citoyens-v1':
      'Marine Le Pen défend le recours au référendum dans ce discours. Elle ne décrit pas de nouveau dispositif d’initiative citoyenne dans le passage cité.',
  },
  'numerique-enseignement-numerique': {
    'melenchon-droit-deconnexion-eleves-personnels-v1':
      'Le programme précise les conditions d’usage du numérique à l’école. Le passage ne donne pas de programme d’apprentissage des outils.',
  },
  'numerique-hebergement-sante': {
    'philippe-assistant-medical-ia-gratuit-v1':
      'Le programme précise que son assistant médical serait hébergé en France. La proposition se limite à cet outil.',
  },
  'agriculture-installation-fermes': {
    'saforcada-controler-prises-controle-indirectes-foncier-agricole-v1':
      'Le contrôle vise les transactions foncières par prise de contrôle de société. Il complète les dispositifs d’installation des exploitants.',
  },
  'institutions-logiciels-publics': {
    'saforcada-exiger-interface-francaise-marches-logiciels-publics-v1':
      'Le critère de sélection porte sur la langue de l’interface et de la documentation.',
    'saforcada-financer-outils-libres-langue-francaise-v1':
      'Le financement de logiciels libres inclut certains outils linguistiques destinés aux services publics.',
    'saforcada-proteger-cloud-donnees-sensibles-extraterritorialite-v1':
      'La charte privilégie les logiciels libres maintenus en France pour l’hébergement des données sensibles. Ce passage porte sur ce périmètre.',
    'roussel-congres-pole-public-numerique-logiciel-libre-v1':
      'Le logiciel libre est prévu comme base d’un pôle public du numérique. Le passage ne détaille pas les règles d’achat de logiciels pour les administrations.',
  },
  'fiscalite-transmission-patrimoine': {
    'saforcada-faciliter-transmission-entreprises-productives-v1':
      'Cette mesure facilite la transmission des entreprises productives. Le passage ne fixe pas de barème général de succession.',
  },
  'climat-prix-energie': {
    'renaissance-garantir-dix-ans-de-prix-industriels-de-lelectricite-autour-de-50-euros-par-v1':
      'Le prix annoncé concerne les industriels qui respectent des objectifs de décarbonation et d’électrification.',
    'polony-refuser-cession-production-nucleaire-fournisseurs-tiers-v1':
      'Le communiqué porte sur les obligations d’EDF vis-à-vis de fournisseurs concurrents dans le projet EPR2. Il ne définit pas de tarif pour les ménages.',
    'roussel-congres-pole-public-energie-edf-engie-total-v1':
      'Le texte associe maîtrise des prix et contrôle public de l’énergie, avec un pôle réunissant les grands opérateurs. Il ne chiffre pas de nouveau tarif.',
    'melenchon-reconstituer-pole-public-energie-engie-v1':
      'Le programme veut reprendre le contrôle public d’opérateurs et revenir sur la libéralisation. Il ne fixe pas de tarif dans ce passage.',
  },
  'logement-offre-bati': {
    'attal-lci-creer-un-statut-fiscal-du-bailleur-prive-qui-favorise-linvestissement-locat-v1':
      'La fiscalité proposée vise à encourager les propriétaires privés à mettre des logements en location.',
    'rohou-fiscalite-materiaux-construction-economes-v1':
      'Le texte privilégie certains matériaux dans le bâti neuf.',
    'philippe-maires-distribution-aides-renovation-pierre-v1':
      'Le candidat précise qui distribuerait les aides à la rénovation énergétique et les aides à la pierre. Le passage ne fixe pas les montants ni les critères d’accès.',
    'rohou-justifier-absence-alternative-fonciere-v1':
      'Le MEI veut examiner la rénovation, la densification et le réemploi des friches avant de consommer du foncier. Le passage ne fixe aucun objectif de production de logements.',
  },
  'institutions-contributions-citoyennes': {
    'durif-associer-citoyens-aux-priorites-budgetaires-v1':
      'Sylvain Durif applique la participation citoyenne aux choix de crédits sans présenter de procédure pour formuler ces choix.',
    'cheve-estimer-cout-remontee-citoyenne-v1':
      'Le rapport du collectif éclaire les coûts déclarés de sa plateforme de participation et donne deux estimations différentes des économies attendues.',
    'legendre-voter-en-ligne-consultations-gouvernementales-v1':
      'Le manifeste détaille une participation en ligne aux consultations. Il ne fixe pas de droit d’initiative ni de seuil de déclenchement.',
  },
  'travail-demarches-entreprises': {
    'saforcada-proposer-un-accord-type-participation-aux-pme-v1':
      'Le modèle et la déclaration en ligne simplifieraient un dispositif volontaire de participation pour les PME.',
  },
  'climat-eau-potable': {
    'lepen-outremer-suppleance-etat-eau-potable-v1':
      'Marine Le Pen a soutenu la proposition dans son communiqué du 8 octobre 2026. Elle n’a pas été adoptée.',
    'saforcada-rattraper-acces-services-de-base-outre-mer-v1':
      'L’accès à l’eau et à l’assainissement est un volet d’un rattrapage de plusieurs services essentiels en outre-mer.',
    'melenchon-reconnaitre-crise-sanitaire-eau-guadeloupe-martinique-v1':
      'La reconnaissance de la crise vise la Guadeloupe et la Martinique, notamment la contamination de l’eau et l’assainissement. Les travaux sur les réseaux sont abordés dans une autre fiche.',
  },
  'numerique-recommandations': {
    'saforcada-auditer-recommandations-culturelles-et-mesurer-exposition-v1':
      'L’audit concerne les recommandations qui orientent fortement l’accès aux œuvres culturelles.',
  },
  'europe-participation-union': {
    'attal-nov28-retour-royaume-uni-union-europeenne-v1':
      'La proposition concerne les relations avec le Royaume-Uni et la création de coopérations entre États volontaires.',
    'asselineau-referendum-dispositions-constitutionnelles-sortie-ue-v1':
      'Cette révision adapte la Constitution à la sortie de l’Union. La notification prévue dès la première semaine est traitée dans une autre fiche.',
    'melenchon-restituer-souverainete-budgetaire-parlements-nationaux-v1':
      'Cette disposition est un objectif de négociation des traités. Le passage prévoit un référendum sur un éventuel accord.',
    'melenchon-refuser-application-pacte-europeen-migration-asile-v1':
      'Le programme traite ici de l’application d’une législation européenne précise relative à l’asile et à la migration.',
    'polony-envisager-suspension-contribution-budget-ue-v1':
      'Lors de l’entretien, la suspension est citée comme un levier de négociation. La candidate dit par ailleurs vouloir rester dans l’Union.',
    'asselineau-organiser-debats-audiovisuels-sortie-ue-v1':
      'Il s’agit d’un débat public sur la sortie européenne déjà défendue séparément par le candidat.',
  },
  'numerique-cloud-sensible': {
    'melenchon-proposer-services-en-ligne-heberges-en-france-v1':
      'Le passage traite d’une offre hébergée en France et soumise au droit français pour les citoyens et les entreprises. Les données souveraines et sensibles de l’État relèvent de mesures distinctes.',
  },
  'regularisation-sejour': {
    'arthaud-sopposer-aux-expulsions-sans-papiers-v1':
      'La brochure s’oppose aussi aux expulsions dans le passage qui appelle à régulariser les personnes sans papiers.',
  },
  'travail-aides-cooperatives': {
    'lisnard-remplacer-information-cession-incitation-v1':
      'La mesure concerne spécifiquement la reprise d’une entreprise par ses salariés.',
    'billetdoux-debattre-perimetre-aides-cooperatives-v2':
      'Augustin Billetdoux pose la question d’un accès réservé aux coopératives ou ouvert aussi à des entreprises classiques. Il laisse le critère d’éligibilité à débattre.',
  },
  'securite-lutte-racisme': {
    'renaissance-publier-les-resultats-de-tests-de-discrimination-a-lembauche-v1':
      'La convention propose des tests de discriminations à l’embauche dans son chapitre consacré à la lutte contre le racisme, l’antisémitisme et les discriminations.',
    'renaissance-permettre-des-tests-individuels-pour-apporter-la-preuve-dune-discrimination-v1':
      'Le test individuel serait un moyen d’établir une discrimination. Le document le présente dans son chapitre consacré aussi au racisme et à l’antisémitisme.',
    'riner-encourager-plaintes-victimes-racisme-v1':
      'Teddy Riner appelle les victimes à porter plainte. Il ne présente aucune modification de la procédure.',
  },
  'education-rythmes-scolaires': {
    'mathieu-appliquer-propositions-convention-temps-scolaires-v1':
      'Benoît Mathieu demande de suivre les recommandations de la convention. Le passage ne choisit aucun horaire.',
  },
  'retraites-conditions-depart': {
    'mathieu-confier-debat-retraites-citoyens-tires-au-sort-v1':
      'Benoît Mathieu propose de faire délibérer des citoyens tirés au sort. Il ne décide ni de l’âge de départ ni du montant des pensions.',
  },
  'europe-cooperations-industrielles': {
    'renaissance-tripler-la-taille-du-conseil-europeen-de-linnovation-v1':
      'Il s’agit d’un soutien commun à l’innovation au niveau européen. La convention ne précise pas de projet industriel bilatéral.',
    'polony-nouer-alliances-avec-espagne-et-italie-v1':
      'L’entretien évoque des rapprochements entre gouvernements. Il ne désigne pas de coopération industrielle précise.',
  },
  'education-financement-des-etudes': {
    'renaissance-creer-un-contrat-de-travail-etudiant-plafonne-a-15-heures-par-semaine-v1':
      'Le financement des études est ici abordé à travers un emploi salarié encadré, avec une limite hebdomadaire de quinze heures.',
    'retailleau-relever-droits-inscription-etudiants-etrangers-v1':
      'Le passage concerne les droits d’inscription des étudiants étrangers visés par son volet migratoire.',
    'legendre-moyens-universites-recherche-v1':
      'Le passage propose d’examiner les difficultés financières des universités et de la recherche avant de fixer les moyens.',
  },
  'numerique-centres-de-calcul': {
    'dubuisson-datacenters-souverains-outre-mer-v1':
      'Le texte traite de souveraineté et d’implantation des centres de données, notamment outre-mer.',
  },
  'institutions-liberte-medias': {
    'asselineau-refuser-suspension-reseaux-sociaux-troubles-v1':
      'Le passage porte sur l’accès aux réseaux sociaux pendant des troubles graves.',
  },
  'retraites-protection-revenus': {
    'collovati-retraite-bon-comportement-v1':
      'La proposition porte sur les droits supplémentaires acquis selon un critère de comportement.',
  },
  'numerique-decisions-automatisees': {
    'renaissance-autoriser-certaines-transcriptions-policieres-avec-une-ia-souveraine-contro-v1':
      'Le dispositif porte sur la transcription de certains actes policiers et exige une validation humaine.',
  },
  'numerique-contenu-synthetique': {
    'renaissance-accompagner-les-victimes-de-diffusion-dimages-sexuelles-sans-consentement-v1':
      'L’accompagnement vise les personnes victimes de publications sexuelles sans consentement, dont les hypertrucages.',
  },
  'immigration-entree-sejour': {
    'philippe-nov28-mettre-fin-a-ce-que-le-programme-appelle-lasile-a-vie-v1':
      'Le programme souhaite revoir la durée de protection. Les échéances et critères de réexamen restent à préciser.',
  },
  'securite-enquetes-et-trafics': {
    'lisnard-proportionner-obligations-antiblanchiment-v1':
      'Le passage traite de la prévention du blanchiment et des obligations de mise en conformité pour les petites structures.',
  },
  'climat-risques-naturels': {
    'lisnard-adapter-ventilation-microstations-v1':
      'Le passage concerne les normes d’assainissement non collectif.',
  },
  'immigration-eloignement': {
    'lisnard-tester-centres-retention-administrative-etranger-v1':
      'Le candidat propose de tester des centres de rétention hors du territoire.',
    'zemmour-gouvernement-dix-ministeres-v1':
      'Le passage précise le ministère auquel Éric Zemmour confierait cette politique.',
  },
  'logement-performance-energetique': {
    'retailleau-reporter-paliers-re2020-2028-2031-v1':
      'Le passage concerne la réglementation environnementale des bâtiments neufs.',
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
  'climat-restrictions-publicite': [
    'publicité et écologie',
    'interdiction de certaines publicités',
    'interdire certaines publicités',
  ],
  'institutions-duree-mandat-presidentiel': [
    'septennat',
    'durée du mandat présidentiel',
  ],
  'institutions-haute-administration': [
    'haute fonction publique',
    'grands corps de l’État',
  ],
  'institutions-dissolution-assemblee': [
    'dissolution de l’Assemblée nationale',
  ],
  'climat-condition-animale': ['protection animale'],
  'securite-service-militaire': ['service militaire obligatoire'],
  'institutions-conseil-prive-etat': [
    'cabinets qui conseillent gratuitement l’État',
    'cabinets de conseil privés',
    'recours de l’État aux cabinets',
  ],
  'institutions-controle-depense-publique': [
    'pouvoirs de la Cour des comptes',
    'contrôle de la gestion publique',
  ],
  'institutions-age-eligibilite-president': [
    'âge minimum pour être président',
    'âge requis pour la présidence',
  ],
  'institutions-liberte-medias': ['liberté des médias', 'fermeture des médias'],
  'europe-cooperations-industrielles': [
    'coopération industrielle avec la Chine',
    'coopération industrielle internationale',
  ],
  'institutions-protection-patrimoine': ['protection du patrimoine culturel'],
  'education-acces-culture': [
    'visites scolaires du patrimoine',
    'accès des jeunes à la culture',
  ],
  'sante-protection-ivg': [
    'accès à l’IVG',
    'protection constitutionnelle de l’IVG',
    'soutient la protection constitutionnelle de l’IVG',
  ],
  'securite-lutte-racisme': [
    'lutte contre le racisme',
    'plaintes pour des faits racistes',
    'dit au sujet des plaintes pour des faits racistes',
  ],
  'logement-attribution-nationalite': [
    'préférence nationale pour le logement social',
    'nationalité et attribution des HLM',
    'soutient la préférence nationale pour le logement social',
  ],
  'institutions-finances-communes': [
    'financement des communes',
    'moyens financiers des communes',
    'visibilité budgétaire des communes',
    'vote avant d’augmenter les impôts communaux',
  ],
  'travail-conditions-aides-entreprises': [
    'conditions des aides aux entreprises',
    'conditionner les aides publiques aux entreprises',
  ],
  'institutions-service-civique-obligatoire': ['service civique obligatoire'],
  'education-rythmes-scolaires': ['rythmes scolaires', 'temps de l’enfant'],
  'institutions-information-referendaire': [
    'information avant un référendum',
    'médias pendant une campagne référendaire',
  ],
  'travail-aides-cooperatives': [
    'conditionner les aides aux coopératives',
    'comment prévoit-il de conditionner les aides aux sociétés coopératives',
    'soutien aux coopératives',
    'aides aux coopératives',
    'aides publiques aux coopératives',
  ],
  'sante-experimentation-animale': [
    'expérimentation animale',
    'recherche sans expérimentation animale',
  ],
  'institutions-voile-espace-public': [
    'voile dans l’espace public',
    'port du voile dans l’espace public',
    'interdiction du voile dans l’espace public',
  ],
  'travail-automatisation-intelligence-artificielle': [
    'ia et emploi',
    'automatisation du travail',
    'remplacement du travail par l’ia',
  ],
  'europe-accord-mercosur': [
    'accord avec le Mercosur',
    'accord UE-Mercosur',
    'traité UE-Mercosur',
    'Mercosur',
  ],
  'institutions-revocation-elus': [
    'révocation des élus',
    'mandats révocables',
    'référendum révocatoire',
  ],
  'aide-ukraine': [
    'aide à l’Ukraine',
    'aide française à l’Ukraine',
    'l’aide à l’Ukraine et les moyens des communes',
    'dit sur l’aide à l’Ukraine et les moyens des communes',
  ],
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
  'travail-salaire-minimum': [
    'SMIC',
    'hausse du SMIC',
    'salaire minimum',
    'salariés au SMIC',
    'salarié au SMIC',
  ],
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
    'transmission des contributions citoyennes à la présidence',
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
  'places-prison': [
    'places de prison',
    'construction de prisons',
    'construire de nouvelles places de prison',
  ],
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
  'climat-eau-potable': [
    'eau potable',
    'réseaux d’eau',
    'fuites des réseaux d’eau',
  ],
  'numerique-hebergement-sante': ['hébergement des données de santé'],
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
