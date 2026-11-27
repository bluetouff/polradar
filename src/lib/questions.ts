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
    'tinland-reduire-duree-travail-v1',
    'platret-retour-39-heures-v1',
    'villepin-reserver-aux-partenaires-sociaux-certains-choix-sur-les-salaires-et-le-temps-de-v1',
    'ecologistes-passer-a-32-heures-sans-baisse-de-salaire-pour-les-metiers-penibles-ou-de-nu-v1',
    'lisnard-temps-de-travail-accords-v1',
    'ps-experimenter-la-semaine-de-quatre-jours-par-la-negociation-collective-v1',
  ],
  'climat-production-nucleaire': [
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
    'roussel-congres-regulariser-familles-enfants-scolarises-v1',
    'labib-regulariser-tous-les-sans-papiers-v1',
    'philippe-soumettre-les-regularisations-massives-a-un-accord-entre-etats-schengen-v1',
    'lisnard-interdire-regularisation-apres-entree-clandestine-v1',
  ],
  'immigration-travail': [
    'saforcada-titre-probatoire-immigration-travail-3-6-mois-v1',
    'lepen-taxe-embauche-extracommunautaires-v1',
    'legendre-exiger-une-demande-prealable-a-lambassade-pour-limmigration-economique-v1',
    'bonnal-regularisation-cas-par-cas-metiers-en-tension-v1',
    'dupont-aignan-conditionner-limmigration-economique-au-niveau-du-chomage-v1',
    'philippe-introduire-des-quotas-dimmigration-selon-les-profils-recherches-v1',
    'groupe-rn-creer-une-taxe-a-lembauche-dun-salarie-extra-europeen-v2',
  ],
  'soins-de-proximite': [
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
    'ps-reviser-loi-sru-sanctionner-villes-carencees-v1',
    'tinland-maires-permis-logements-sociaux-v1',
    'bonnal-maintenir-quotas-loi-sru-v1',
    'roussel-sru-30-logements-sociaux-v1',
    'dlf-accession-sociale-quota-sru-v1',
    'dlf-seuil-logements-sociaux-communes-v1',
    'lisnard-supprimer-article-55-de-la-loi-sru-v1',
  ],
  'logement-offre-bati': [
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
    'lisnard-eolien-certains-projets-et-reserve-en-mer-v1',
    'place-publique-plans-regionaux-renouvelables-vent-v1',
    'tinland-arreter-eolien-v1',
    'retailleau-interrompre-des-appels-doffres-solaires-et-eoliens-en-mer-v1',
    'melenchon-refuser-les-parcs-solaires-et-eoliens-qui-exigent-une-coupe-rase-v1',
    'groupe-rn-moratoire-eolien-et-solaire-2025-v1',
  ],
  'regroupement-familial': [
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
    'philippe-social-1-v4',
    'delmur-pension-alimentaire-salaire-v1',
    'becht-confier-une-mission-daide-aux-familles-monoparentales-aux-maisons-de-vie-v1',
    'melenchon-creer-statut-famille-monoparentale-v1',
  ],
  'places-prison': [
    'saforcada-construire-capacites-detention-et-separer-profils-v1',
    'zemmour-prisons-100000-places-v1',
    'herlin-places-prison-v1',
    'becht-places-prisons-haute-securite-v1',
    'riner-construire-places-prison-v1',
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
    'lisnard-guichet-numerique-agriculteurs-v2',
    'polony-guichet-numerique-services-publics-v1',
    'dubuisson-eviter-redemande-documents-administratifs-v2',
    'pic-droits-services-hors-ligne-v1',
    'dlf-accessibilite-services-publics-numeriques-v1',
    'ecologistes-garantir-un-accueil-physique-de-service-public-a-quinze-minutes-v1',
  ],
  'immigration-droit-sol': [
    'saforcada-maintenir-droit-sol-avec-demarche-volontaire-v1',
    'roussel-congres-maintenir-droit-sol-et-asile-v1',
    'lisnard-fin-automaticite-droit-du-sol-v1',
    'tinland-citoyennete-residence-nationalite-v1',
    'melenchon-garantir-droit-du-sol-integral-v1',
    'lepen-supprimer-droit-du-sol-parti-v1',
    'zemmour-supprimer-droit-du-sol-v1',
  ],
  'immigration-aide-medicale-etat': [
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
    'melenchon-outil-gratuit-facturation-electronique-pme-v1',
    'lepen-supprimer-normes-entreprises-par-ordonnances-v1',
    'lisnard-geler-normes-suspendre-surtranspositions-v1',
    'lisnard-etendre-procedures-simplifiees-grands-chantiers-v1',
    'tinland-alleger-fiscalite-entreprises-v1',
    'lisnard-guichet-numerique-agriculteurs-v2',
  ],
  'numerique-enseignement-numerique': [
    'roussel-congres-education-image-et-numerique-v1',
    'melenchon-developper-education-numerique-enfants-v1',
    'lisnard-former-eleves-usages-intelligence-artificielle-v1',
  ],
  'climat-eau-potable': [
    'melenchon-installer-fontaines-douches-sanitaires-gratuits-v1',
    'melenchon-analyser-systematiquement-contaminants-eau-v1',
    'melenchon-gerer-eau-assainissement-en-regie-v1',
    'melenchon-financer-canalisations-eau-guadeloupe-v1',
    'melenchon-declencher-orsec-eau-plafonner-bouteilles-v1',
    'melenchon-ne-pas-repercuter-dette-eau-investissements-v1',
  ],
  'institutions-revocation-elus': ['kazib-rendre-mandats-revocables-v1'],
  'aide-ukraine': ['lalanne-cesser-envois-fonds-ukraine-v1'],
  'europe-accord-mercosur': ['lassalle-demander-opposition-france-mercosur-v1'],
  'sante-experimentation-animale': [
    'markovic-investir-recherche-remplacement-experimentation-animale-v1',
    'markovic-accelerer-validation-methodes-sans-animaux-v1',
    'markovic-renforcer-controle-procedures-experimentation-animale-v1',
  ],
  'institutions-voile-espace-public': [
    'arthaud-sopposer-interdiction-voile-espace-public-v1',
  ],
  'travail-automatisation-intelligence-artificielle': [
    'lalanne-consulter-population-remplacement-travail-ia-v1',
  ],
};
const scopedComplements: Record<string, Record<string, string>> = {
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
    'riner-interroger-consequences-aide-ukraine-v1':
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
    'philippe-deployer-un-plan-dutilisation-de-lia-dans-les-services-publics-v2':
      'Le projet prévoit de traiter certaines démarches simples avec l’IA. Le passage ne précise pas le canal de dépôt pour les usagers.',
    'place-publique-automatiser-acces-droits-dossier-social-unique-v1':
      'Le dossier social vise à ouvrir automatiquement certains droits. Le passage prévoit aussi des guichets physiques et ne décrit pas de procédure de dépôt en ligne.',
  },
  'sante-remboursement-soins': {
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
    'polony-refuser-cession-production-nucleaire-fournisseurs-tiers-v1':
      'Le communiqué porte sur les obligations d’EDF vis-à-vis de fournisseurs concurrents dans le projet EPR2. Il ne définit pas de tarif pour les ménages.',
    'roussel-congres-pole-public-energie-edf-engie-total-v1':
      'Le texte associe maîtrise des prix et contrôle public de l’énergie, avec un pôle réunissant les grands opérateurs. Il ne chiffre pas de nouveau tarif.',
    'melenchon-reconstituer-pole-public-energie-engie-v1':
      'Le programme veut reprendre le contrôle public d’opérateurs et revenir sur la libéralisation. Il ne fixe pas de tarif dans ce passage.',
  },
  'logement-offre-bati': {
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
    'billetdoux-debattre-perimetre-aides-cooperatives-v1':
      'Augustin Billetdoux pose la question d’un accès réservé aux coopératives ou ouvert aussi à des entreprises classiques. Il laisse le critère d’éligibilité à débattre.',
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
  'travail-aides-cooperatives': [
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
