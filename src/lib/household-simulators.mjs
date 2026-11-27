import { euro } from './csg-paie.mjs';

const servicePublic =
  'https://www.service-public.gouv.fr/particuliers/vosdroits/';
const fuelNote =
  'https://www.ecologie.gouv.fr/sites/default/files/documents/NPG-2026.11.20.pdf#page=6';
const consultationSource = {
  title: 'Assurance Maladie · remboursement des consultations',
  url: 'https://www.ameli.fr/assure/remboursements/rembourse/consultations-telemedecine/metropole',
};
const commutingSource = {
  title: 'Service Public · prise en charge des transports par l’employeur',
  url: servicePublic + 'F19846',
};
const childcareSource = {
  title: 'Caf · barème des participations familiales 2026',
  url: 'https://www.caf.fr/sites/default/files/medias/661/Espace-Partenaires/Documents-Partenaires/2026-Baremes-Participation-Famille-Eaje.pdf',
};
const transferTaxSource = {
  title: 'Finances publiques · taxe sur l’achat dans l’ancien',
  url: 'https://www.impots.gouv.fr/particulier/questions/jachete-un-bien-immobilier-quaurai-je-payer-comme-frais-au-notaire',
};

/**
 * @typedef {{title: string, url: string}} Link
 * @typedef {{id: string, label: string, value: string, min: number, max: number, precision: number, options?: {value: string, label: string}[]}} Field
 * @typedef {{detail: string, value?: number | null, nationality?: number, priceBand?: [number, number]}} Rule
 * @typedef {Rule & ({measure: string} | {label: string, context: string, source: Link})} Alternative
 * @typedef {{measure: string, detail?: string}} Position
 * @typedef {{id: string, title: string, icon: string, summary: string, measureUnit: 'euros' | 'heures' | 'eligible', resultTitle: string, fields: Field[], baseline: Rule & {label: string, source: Link}, alternatives: Alternative[], positions?: Position[], method: string, example?: string, sources?: Link[]}} Simulator
 */

/** @type {Simulator[]} */
export const householdSimulators = [
  {
    id: 'temps-de-travail',
    title: 'Temps de travail',
    icon: 'travail',
    summary: 'Comparer les durées hebdomadaires et les règles proposées.',
    measureUnit: 'heures',
    resultTitle: 'Heures sur la période choisie',
    fields: [
      {
        id: 'weeks',
        label: 'Semaines travaillées',
        value: '1',
        min: 1,
        max: 52,
        precision: 0,
      },
    ],
    baseline: {
      label: 'Durée légale de référence',
      detail: '35 heures par semaine pour un salarié à temps plein',
      value: 35,
      source: {
        title: 'Service Public · durée du travail',
        url: servicePublic + 'F1911',
      },
    },
    alternatives: [
      {
        measure: 'collovati-travail-semaine-39-heures',
        detail: '39 heures par semaine',
        value: 39,
      },
      {
        measure: 'herlin-semaine-40-heures',
        detail: '40 heures par semaine',
        value: 40,
      },
      {
        measure: 'kazib-travail-temps',
        detail: '28 heures par semaine',
        value: 28,
      },
      {
        measure: 'platret-retour-39-heures',
        detail: '39 heures par semaine',
        value: 39,
      },
    ],
    positions: [
      {
        measure: 'attal-semaine-quatre-jours-heures-mensuelles',
        detail:
          'Répartir le même nombre d’heures mensuelles sur quatre jours par semaine, lorsque l’activité le permet.',
      },
      { measure: 'attal-travail-plafond-heures-supplementaires' },
      { measure: 'arthaud-reduire-temps-charge-travail' },
      {
        measure: 'arthaud-reduire-journees-cadences-canicule',
        detail:
          'Réduire la journée de travail et les cadences en période de fortes chaleurs. La proposition ne fixe pas de durée hebdomadaire.',
      },
      { measure: 'lisnard-temps-de-travail-accords' },
      { measure: 'tinland-reduire-duree-travail' },
      {
        measure: 'melenchon-travail-2',
        detail:
          '35 heures comme durée légale générale, 32 heures pour les métiers pénibles ou de nuit, puis extension par accord collectif.',
      },
      {
        measure: 'philippe-travail-1',
        detail:
          'Laisser chaque entreprise fixer sa durée par accord. Les seuils de 35 et 37 heures servent à définir les exonérations.',
      },
      { measure: 'retailleau-temps-de-travail-accord-entreprise' },
      { measure: 'riner-travail-volontaire' },
      {
        measure: 'roussel-semaine-32-heures-horizon',
      },
      { measure: 'labib-travail-temps' },
      {
        measure:
          'villepin-reserver-aux-partenaires-sociaux-certains-choix-sur-les-salaires-et-le-temps-de',
      },
      {
        measure:
          'ecologistes-passer-a-32-heures-sans-baisse-de-salaire-pour-les-metiers-penibles-ou-de-nu',
      },
      {
        measure:
          'ps-experimenter-la-semaine-de-quatre-jours-par-la-negociation-collective',
      },
    ],
    method:
      'Durée hebdomadaire multipliée par les semaines travaillées que vous choisissez. La durée légale de 35 heures sert de référence pour un salarié majeur à temps plein dans le privé. Les accords collectifs, heures supplémentaires et congés demandent un calcul distinct.',
  },
  {
    id: 'smic',
    title: 'Salaire minimum',
    icon: 'euro',
    summary: 'Mettre les montants nets annoncés face au SMIC de référence.',
    measureUnit: 'euros',
    resultTitle: 'Salaire net sur la période choisie',
    fields: [
      {
        id: 'months',
        label: 'Mois payés au même montant',
        value: '1',
        min: 1,
        max: 12,
        precision: 0,
      },
    ],
    baseline: {
      label: 'SMIC de référence',
      detail: '1 477,93 € nets indicatifs par mois au 1ᵉʳ juin 2026',
      value: 147793,
      source: {
        title: 'Service Public · SMIC au 1ᵉʳ juin 2026',
        url: servicePublic + 'F2300',
      },
    },
    alternatives: [
      {
        measure: 'arthaud-travail-smic',
        detail: '2 200 € nets par mois',
        value: 220000,
      },
      {
        measure: 'branco-travail-smic-national',
        detail: '1 500 € nets par mois',
        value: 150000,
      },
      {
        measure: 'dupont-aignan-travail-smic',
        detail: '1 600 € nets par mois',
        value: 160000,
      },
      {
        measure: 'kazib-travail-smic',
        detail: '2 000 € nets par mois',
        value: 200000,
      },
      {
        measure: 'melenchon-travail-1',
        detail: '1 700 € nets par mois',
        value: 170000,
      },
      {
        measure: 'ps-travail-smic',
        detail: '1 690 € nets par mois',
        value: 169000,
      },
      {
        measure: 'roussel-smic-1700-net',
        detail: '1 700 € nets par mois',
        value: 170000,
      },
    ],
    positions: [
      { measure: 'tinland-revaloriser-smic' },
      {
        measure: 'tondelier-travail-1',
        detail: 'Objectif de 2 000 € bruts par mois dès 2027.',
      },
    ],
    method:
      'Comparaison à temps plein avec le montant net indicatif publié au 1ᵉʳ juin 2026 dans le cas général. Chaque scénario multiplie un montant mensuel constant par le nombre de mois saisi. Les aides, l’impôt et les effets sur les autres salaires restent hors du calcul.',
  },
  {
    id: 'carburants',
    title: 'Prix du carburant',
    icon: 'climat',
    summary: 'Comparer sur les mêmes litres les baisses de taxes ou de prix.',
    measureUnit: 'euros',
    resultTitle: 'Prix TTC pour le volume choisi',
    example:
      'Prix prérempli du SP95-E10, moyenne nationale de la DGEC au 20 novembre 2026.',
    fields: [
      {
        id: 'litres',
        label: 'Volume en litres',
        value: '40',
        min: 0,
        max: 5000,
        precision: 2,
      },
      {
        id: 'price',
        label: 'Prix TTC au litre en euros',
        value: '1,9514',
        min: 0.4,
        max: 10,
        precision: 4,
      },
    ],
    baseline: {
      label: 'Prix saisi à la pompe',
      detail: 'Taux normal de TVA de 20 %',
      source: {
        title: 'Ministère de l’Économie · taux de TVA',
        url: 'https://www.economie.gouv.fr/particuliers/impots-et-fiscalite/gerer-mes-autres-impots-et-taxes/tva-quels-sont-les-taux-de-votre-quotidien',
      },
    },
    alternatives: [
      {
        measure: 'dupont-aignan-fiscalite-carburant',
        detail: 'Objectif de baisse de 40 centimes au litre',
        value: 40,
      },
      {
        measure: 'zemmour-taxes-carburants',
        detail:
          '40 centimes de taxe en moins par litre, si la baisse se répercute au prix TTC',
        value: 40,
      },
      {
        label: 'Marine Le Pen',
        detail: 'TVA à 5,5 % sur les carburants',
        context: 'Amendement rejeté le 2 novembre 2026',
        source: {
          title: 'Assemblée nationale · amendement I-635',
          url: 'https://www.assemblee-nationale.fr/dyn/17/amendements/3210A/AN/635',
        },
      },
      {
        measure: 'villepin-encadrer-le-prix-des-carburants-par-la-fiscalite',
        detail: 'Fourchette proposée de 1,75 à 2,50 € le litre',
        priceBand: [1.75, 2.5],
      },
    ],
    positions: [{ measure: 'labib-fiscalite-tva-progressivite' }],
    sources: [
      { title: 'DGEC · prix TTC au 20 novembre 2026, page 6', url: fuelNote },
    ],
    method:
      'Chaque proposition est appliquée séparément au même volume. La baisse de 40 centimes suppose une répercussion intégrale à la pompe. La simulation de TVA divise le prix saisi par 1,20 puis applique le taux de 5,5 % à la même base. Pour la fourchette de prix, le scénario suppose que les accises ramènent un prix extérieur à la fourchette à sa borne la plus proche.',
  },
  {
    id: 'loyers',
    title: 'Loyer mensuel',
    icon: 'logement',
    summary:
      'Comparer une révision selon l’IRL, un gel et une baisse annoncée.',
    measureUnit: 'euros',
    resultTitle: 'Loyer mensuel hors charges',
    example:
      'Exemple de Service Public pour un bail de 600 € révisé en juillet 2026.',
    fields: [
      {
        id: 'rent',
        label: 'Loyer actuel hors charges en euros',
        value: '600',
        min: 0,
        max: 10000,
        precision: 2,
      },
      {
        id: 'previous',
        label: 'Indice IRL de l’année précédente',
        value: '146,68',
        min: 1,
        max: 300,
        precision: 2,
      },
      {
        id: 'next',
        label: 'Indice IRL de la nouvelle année',
        value: '148,37',
        min: 1,
        max: 300,
        precision: 2,
      },
    ],
    baseline: {
      label: 'Révision selon l’IRL',
      detail:
        'Pour un bail du parc privé comportant une clause de révision qui peut s’appliquer',
      source: {
        title: 'Service Public · indice de référence des loyers',
        url: servicePublic + 'F13723',
      },
    },
    alternatives: [
      {
        measure: 'collovati-logement-loyers',
        detail: 'Objectif de baisse de 30 %, appliqué au loyer saisi',
        value: 0.7,
      },
      {
        measure: 'kazib-geler-plafonner-loyers',
        detail: 'Gel appliqué au loyer saisi',
        value: 1,
      },
      {
        measure: 'melenchon-logement-loyers',
        detail: 'Gel avant l’encadrement proposé',
        value: 1,
      },
    ],
    positions: [
      {
        measure:
          'philippe-donner-aux-maires-la-decision-sur-lencadrement-des-loyers',
      },
      { measure: 'retailleau-logement-loyers' },
      { measure: 'tinland-loyers-15-pour-cent' },
      { measure: 'tondelier-logement-loyers-encadrement' },
    ],
    method:
      'Sélectionnez deux indices du même trimestre et de la zone du logement. La révision multiplie le loyer actuel par le rapport des indices. Certaines révisions sont interdites, dont celles de logements classés F ou G sous les conditions décrites par Service Public. Pour le gel et l’objectif de baisse, la comparaison illustre seulement l’effet annoncé sur le loyer saisi.',
  },
  {
    id: 'successions',
    title: 'Droits de succession',
    icon: 'social',
    summary:
      'Calculer les droits sur la part reçue d’un parent et comparer les suppressions proposées.',
    measureUnit: 'euros',
    resultTitle: 'Droits calculés au barème',
    fields: [
      {
        id: 'share',
        label: 'Part nette reçue d’un parent en euros',
        value: '150000',
        min: 0,
        max: 20000000,
        precision: 0,
      },
    ],
    baseline: {
      label: 'Barème de la ligne directe',
      detail: 'Abattement de 100 000 € par parent puis barème progressif',
      source: {
        title: 'Impôts · barème des droits de succession',
        url: 'https://www.impots.gouv.fr/particulier/questions/comment-dois-je-calculer-les-droits-de-succession',
      },
    },
    alternatives: [
      {
        measure: 'herlin-droits-succession',
        detail: 'Suppression des droits de succession',
        value: 0,
      },
      {
        measure: 'villepin-successions-ligne-directe',
        detail:
          'Exonération annoncée jusqu’à 1 million d’euros. Le barème et l’assiette précise du seuil restent à établir.',
        value: null,
      },
      {
        measure: 'zemmour-successions-directes',
        detail: 'Suppression des droits de succession en ligne directe',
        value: 0,
      },
    ],
    positions: [
      { measure: 'billetdoux-heritage-bareme' },
      { measure: 'collovati-relever-le-seuil-dimposition-des-successions' },
      { measure: 'dupont-aignan-fiscalite-transmission' },
      { measure: 'glucksmann-grands-heritages' },
      { measure: 'lisnard-ramener-taux-marginal-succession-20' },
      { measure: 'melenchon-fiscalite-petits-heritages' },
      { measure: 'roussel-fiscalite-heritages' },
      { measure: 'philippot-petits-heritages' },
    ],
    sources: [
      {
        title: 'Service Public · exemple chiffré',
        url: servicePublic + 'F14198',
      },
      {
        title: 'BOFiP · arrondi et minimum de perception',
        url: 'https://bofip.impots.gouv.fr/bofip/2030-PGP.html/identifiant=BOI-ENR-DG-30-20131223',
      },
    ],
    method:
      'Cas d’un enfant recevant une part nette d’un parent. Le calcul suppose l’abattement entier disponible, aucune donation antérieure dans les quinze ans et aucun dispositif particulier. Les taux de 5 % à 45 % ne s’appliquent qu’à la partie concernée par chaque tranche. Le résultat affiche le barème au centime, avant l’arrondi fiscal, le minimum applicable à l’acte et les frais de succession.',
  },
  {
    id: 'allocations-familiales',
    title: 'Allocations familiales',
    icon: 'people',
    summary: 'Voir à partir de combien d’enfants s’ouvre le droit.',
    measureUnit: 'eligible',
    resultTitle: 'Conditions d’ouverture du droit',
    fields: [
      {
        id: 'children',
        label: 'Enfants à charge de moins de 20 ans',
        value: '1',
        min: 0,
        max: 15,
        precision: 0,
      },
      {
        id: 'nationality',
        label: 'Situation du foyer dans le scénario',
        value: '2',
        min: 0,
        max: 2,
        precision: 0,
        options: [
          { value: '2', label: 'Enfants et parents bénéficiaires français' },
          {
            value: '1',
            label:
              'Au moins un parent français, autre membre concerné non français',
          },
          { value: '0', label: 'Aucun parent français' },
        ],
      },
    ],
    baseline: {
      label: 'Règle en métropole',
      detail: 'Au moins deux enfants à charge de moins de 20 ans',
      value: 2,
      source: {
        title: 'Service Public · allocations familiales',
        url: servicePublic + 'F13213',
      },
    },
    alternatives: [
      {
        measure: 'becht-allocations-premier-enfant',
        detail: 'Allocations familiales dès le premier enfant',
        value: 1,
      },
      {
        measure: 'philippe-social-1',
        detail:
          'Allocation unifiée dès le premier enfant, avec un montant dégressif selon le revenu',
        value: 1,
      },
      {
        measure:
          'ecologistes-verser-des-allocations-familiales-de-meme-montant-des-le-premier-enfant',
        detail: 'Même montant par enfant dès le premier',
        value: 1,
      },
      {
        measure:
          'groupe-rn-reserver-les-allocations-familiales-aux-foyers-dont-un-parent-est-francais',
        detail: 'Condition ajoutée d’au moins un parent français',
        value: 2,
        nationality: 1,
      },
      {
        measure: 'saforcada-allocation-nationale-premier-enfant',
        detail:
          'Allocation distincte dès le premier enfant, pour un enfant et des bénéficiaires français',
        value: 1,
        nationality: 2,
      },
    ],
    positions: [
      { measure: 'dlf-allocations-universelles' },
      { measure: 'dlf-allocations-assiduite-scolaire' },
    ],
    method:
      'Le scénario suppose les conditions de résidence et de séjour remplies en métropole. Il compare le seuil d’enfants et les conditions de nationalité que les textes précisent, à autres conditions constantes. Les scénarios de Philippe et de Saforcada décrivent leurs allocations proposées. Les montants dépendent des barèmes et des ressources.',
  },
  {
    id: 'impot-sur-le-revenu',
    title: 'Impôt sur le revenu',
    icon: 'fiscalite',
    summary: 'Appliquer le barème 2026 à votre revenu imposable de 2025.',
    measureUnit: 'euros',
    resultTitle: 'Impôt brut au barème 2026',
    fields: [
      {
        id: 'income',
        label: 'Revenu net imposable du foyer en 2025 (€)',
        value: '30000',
        min: 0,
        max: 20000000,
        precision: 0,
      },
      {
        id: 'shares',
        label: 'Parts fiscales',
        value: '1',
        min: 1,
        max: 2,
        precision: 0,
        options: [
          { value: '1', label: '1 part · personne seule sans enfant' },
          { value: '2', label: '2 parts · couple imposé ensemble sans enfant' },
        ],
      },
    ],
    baseline: {
      label: 'Barème de l’impôt sur le revenu',
      detail: 'Taux progressifs de 0 % à 45 % sur le revenu net imposable',
      source: {
        title: 'Service Public · barème 2026',
        url: servicePublic + 'F1419',
      },
    },
    alternatives: [],
    positions: [
      { measure: 'melenchon-fiscalite-1' },
      {
        measure:
          'ps-preparer-la-fusion-de-limpot-sur-le-revenu-de-la-csg-et-de-la-crds',
      },
    ],
    method:
      'Le revenu imposable est divisé par le nombre de parts. Chaque taux s’applique à la fraction de revenu dans la tranche. Le résultat par part est multiplié par le nombre de parts. Le montant est brut, avant décote, réductions, crédits d’impôt et contributions éventuelles.',
  },
  {
    id: 'consultation-medicale',
    title: 'Consultation médicale',
    icon: 'sante',
    summary: 'Voir le reste à payer après remboursement et avant mutuelle.',
    measureUnit: 'euros',
    resultTitle: 'Reste à payer avant mutuelle',
    fields: [
      {
        id: 'fee',
        label: 'Honoraires facturés pour une consultation (€)',
        value: '40',
        min: 30,
        max: 500,
        precision: 2,
      },
    ],
    baseline: {
      label: 'Médecin généraliste de secteur 2 avec OPTAM',
      detail:
        'Base de 30 €. L’Assurance Maladie rembourse 19 € après la participation de 2 €.',
      value: 1900,
      source: consultationSource,
    },
    alternatives: [
      {
        label: 'Médecin généraliste de secteur 2 sans OPTAM',
        context: 'Barème en métropole au 1er janvier 2026',
        detail:
          'Base de 23 €. L’Assurance Maladie rembourse 14,10 € après la participation de 2 €.',
        value: 1410,
        source: consultationSource,
      },
    ],
    positions: [{ measure: 'ps-sante-mutuelle-publique' }],
    method:
      'Même prix facturé dans les deux cas, pour une consultation au cabinet de votre médecin traitant en métropole. Le calcul suppose un adulte soumis à la participation forfaitaire de 2 € et applique le remboursement du régime général. La prise en charge de la mutuelle et les régimes particuliers dépendent de votre situation.',
  },
  {
    id: 'abonnement-transports',
    title: 'Abonnement domicile–travail',
    icon: 'travail',
    summary:
      'Calculer votre reste à charge sur un abonnement de transport public.',
    measureUnit: 'euros',
    resultTitle: 'Coût mensuel après la part de l’employeur',
    fields: [
      {
        id: 'price',
        label: 'Prix mensuel de l’abonnement (€)',
        value: '75',
        min: 0,
        max: 1000,
        precision: 2,
      },
    ],
    baseline: {
      label: 'Prise en charge minimale dans le privé',
      detail: 'L’employeur rembourse 50 % du prix de l’abonnement éligible.',
      value: 50,
      source: commutingSource,
    },
    alternatives: [
      {
        label: 'Si votre employeur prend en charge 75 %',
        context: 'Prise en charge facultative',
        detail: '75 % est le plafond d’exonération indiqué pour 2026.',
        value: 75,
        source: commutingSource,
      },
    ],
    positions: [
      {
        measure: 'roussel-mobilites-renforcer-prise-en-charge-abonnements',
        detail:
          'Renforcer la prise en charge patronale des abonnements. Le cahier cite des cas à 75 % sans proposer un taux général.',
      },
    ],
    method:
      'Cas d’un salarié du privé qui travaille au moins à mi-temps et utilise un abonnement éligible pour ses trajets domicile–travail. Le montant affiché correspond au prix mensuel diminué de la prise en charge, arrondie au centime. En dessous d’un mi-temps, la prise en charge dépend de votre durée de travail.',
  },
  {
    id: 'creche',
    title: 'Coût de la crèche publique',
    icon: 'social',
    summary:
      'Estimer la facture mensuelle d’une place en crèche publique au barème Caf.',
    measureUnit: 'euros',
    resultTitle: 'Participation mensuelle estimée',
    fields: [
      {
        id: 'resources',
        label: 'Ressources mensuelles retenues par la Caf (€)',
        value: '3000',
        min: 0,
        max: 100_000,
        precision: 2,
      },
      {
        id: 'children',
        label: 'Enfants à charge dans le foyer',
        value: '1',
        min: 1,
        max: 10,
        precision: 0,
      },
      {
        id: 'hours',
        label: 'Heures facturées dans le mois pour cette place',
        value: '160',
        min: 0,
        max: 300,
        precision: 2,
      },
    ],
    baseline: {
      label: 'Barème Caf 2026, accueil collectif',
      detail:
        'Le tarif horaire dépend des ressources du foyer et du nombre d’enfants à charge.',
      source: childcareSource,
    },
    alternatives: [
      {
        measure: 'melenchon-creches-publiques-gratuites',
        detail: 'Le plan prévoit la gratuité de l’accueil en crèche publique.',
        value: 0,
      },
    ],
    positions: [
      { measure: 'philippe-plan-garde-enfants' },
      { measure: 'glucksmann-soustraire-creches-ehpad-logique-marchande' },
    ],
    method:
      'Le calcul concerne une place en accueil collectif public conventionné avec la Caf. Il applique le taux d’effort horaire aux ressources mensuelles, avec un plancher de 814,62 € et le plafond national de 8 500 €. Le tarif horaire est arrondi au centime, puis multiplié par les heures facturées. Certaines structures appliquent un plafond supérieur ou déplafonnent. L’estimation correspond au barème standard, avant crédit d’impôt, hors tarifs adaptés au handicap ou à l’aide sociale à l’enfance.',
  },
  {
    id: 'premier-achat-immobilier',
    title: 'Premier achat immobilier',
    icon: 'logement',
    summary:
      'Calculer les droits de mutation sur un premier achat dans l’ancien avant 35 ans.',
    measureUnit: 'euros',
    resultTitle: 'Droits de mutation estimés',
    fields: [
      {
        id: 'price',
        label: 'Prix imposable de l’achat (€)',
        value: '200000',
        min: 1,
        max: 20_000_000,
        precision: 0,
      },
      {
        id: 'departmentRate',
        label: 'Taux départemental applicable (%)',
        value: '4,50',
        min: 1.2,
        max: 4.5,
        precision: 2,
      },
    ],
    baseline: {
      label: 'Taxe sur un premier achat dans l’ancien',
      detail:
        'Part départementale, taxe communale habituelle de 1,20 % et frais de recouvrement.',
      source: transferTaxSource,
    },
    alternatives: [
      {
        measure:
          'philippe-exonerer-de-droits-de-mutation-le-premier-achat-immobilier-avant-35-ans',
        detail:
          'Le programme prévoit d’exonérer les droits de mutation pour un premier achat de résidence principale avant 35 ans.',
        value: 0,
      },
    ],
    method:
      'Pour un premier achat de résidence principale avant 35 ans dans l’ancien, choisissez le taux du département où se trouve le bien. L’estimation utilise la part communale habituelle de 1,20 % et ajoute 2,37 % de la part départementale au titre du recouvrement. Les réductions locales particulières, la contribution de sécurité immobilière, les débours et les honoraires du notaire restent hors du calcul.',
    sources: [
      {
        title: 'Finances publiques · trouver le taux du département',
        url: 'https://www.impots.gouv.fr/droits-denregistrement',
      },
    ],
  },
];

// Taux d’effort horaire en millionièmes, pour un à dix enfants à charge.
const childcareRates = [619, 516, 413, 310, 310, 310, 310, 206, 206, 206];

const brackets = [
  [8072, 5],
  [12109, 10],
  [15932, 15],
  [552324, 20],
  [902838, 30],
  [1805677, 40],
  [Infinity, 45],
];

const incomeBrackets = [
  [11600, 0],
  [29579, 11],
  [84577, 30],
  [181917, 41],
  [Infinity, 45],
];

function progressiveTax(taxable, rates) {
  let cents = 0;
  let previous = 0;
  for (const [upper, rate] of rates) {
    cents += (Math.min(taxable, upper) - previous) * rate;
    if (taxable <= upper) break;
    previous = upper;
  }
  return cents;
}

const calculations = {
  'temps-de-travail': ({ weeks }, row) => weeks * row.value,
  smic: ({ months }, row) => months * row.value,
  carburants: ({ litres, price }, row, baseline) => {
    const cents = litres * price * 100;
    if (baseline) return Math.round(cents);
    if (row.priceBand) {
      const [floor, ceiling] = row.priceBand;
      return Math.round(
        litres * Math.min(ceiling, Math.max(floor, price)) * 100,
      );
    }
    if (row.value === undefined) return Math.round((cents * 1055) / 1200);
    return Math.round(cents - litres * row.value);
  },
  loyers: ({ rent, previous, next }, row) =>
    Math.round(rent * (row.value ?? next / previous) * 100),
  successions: ({ share }, row, baseline) =>
    baseline
      ? progressiveTax(Math.max(0, share - 100_000), brackets)
      : row.value,
  'allocations-familiales': ({ children, nationality }, row) =>
    children >= row.value && nationality >= (row.nationality ?? 0),
  'impot-sur-le-revenu': ({ income, shares }) =>
    Math.round(progressiveTax(income / shares, incomeBrackets) * shares),
  'consultation-medicale': ({ fee }, row) => Math.round(fee * 100) - row.value,
  'abonnement-transports': ({ price }, row) => {
    const cents = Math.round(price * 100);
    return cents - Math.round((cents * row.value) / 100);
  },
  creche: ({ resources, children, hours }, row, baseline) => {
    if (!baseline) return row.value ?? null;
    const cappedResources = Math.min(
      850_000,
      Math.max(81_462, Math.round(resources * 100)),
    );
    const hourlyCents = Math.round(
      (cappedResources * childcareRates[children - 1]) / 1_000_000,
    );
    const hundredthsOfHour = Math.round(hours * 100);
    return Math.round((hourlyCents * hundredthsOfHour) / 100);
  },
  'premier-achat-immobilier': ({ price, departmentRate }, row, baseline) => {
    if (!baseline) return row.value ?? null;
    const departmentBasisPoints = Math.round(departmentRate * 100);
    return Math.round(
      (price * (120 * 10_000 + departmentBasisPoints * 10_237)) / 1_000_000,
    );
  },
};

function parseValue(input, field) {
  if (typeof input !== 'string' || input.length > 22) return null;
  if (field.options && !field.options.some(({ value }) => value === input))
    return null;
  const match = /^(\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.](\d+))?$/u.exec(
    input.trim(),
  );
  if (!match || (match[2]?.length ?? 0) > field.precision) return null;
  const value = Number(
    match[1].replace(/[ \u00a0\u202f]/gu, '') + '.' + (match[2] ?? '0'),
  );
  return value >= field.min && value <= field.max ? value : null;
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} input
 * @returns {{amounts: (number | boolean | null)[]} | {invalid: string} | null}
 */
export function evaluateHousehold(id, input) {
  const scenario = householdSimulators.find((entry) => entry.id === id);
  if (!scenario) return null;
  const values = {};
  for (const field of scenario.fields) {
    const value = parseValue(input[field.id], field);
    if (value === null) return { invalid: field.id };
    values[field.id] = value;
  }
  const calculate = calculations[scenario.id];
  const reference = calculate(values, scenario.baseline, true);
  const alternatives = scenario.alternatives.map((row) =>
    calculate(values, row, false),
  );
  return { amounts: [reference, ...alternatives] };
}

export function householdValue(value, unit) {
  if (value === null) return 'Non chiffrable';
  if (unit === 'eligible')
    return value ? 'Critères remplis' : 'Critères non remplis';
  return unit === 'heures' ? value.toLocaleString('fr-FR') + ' h' : euro(value);
}

export function householdDelta(value, reference, unit) {
  if (typeof value !== 'number' || typeof reference !== 'number') return '';
  const difference = value - reference;
  if (difference === 0) return 'Même résultat que la référence';
  const sign = difference > 0 ? '+' : '−';
  return sign + householdValue(Math.abs(difference), unit);
}
