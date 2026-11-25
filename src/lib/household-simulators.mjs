import { euro } from './csg-paie.mjs';

const servicePublic =
  'https://www.service-public.gouv.fr/particuliers/vosdroits/';
const fuelNote =
  'https://www.ecologie.gouv.fr/sites/default/files/documents/NPG-2026.11.20.pdf#page=6';

/**
 * @typedef {{title: string, url: string}} Link
 * @typedef {{id: string, label: string, value: string, min: number, max: number, precision: number, options?: {value: string, label: string}[]}} Field
 * @typedef {{detail: string, value?: number | null, nationality?: number}} Rule
 * @typedef {Rule & ({measure: string} | {label: string, context: string, source: Link})} Alternative
 * @typedef {{id: string, title: string, icon: string, summary: string, measureUnit: 'euros' | 'heures' | 'eligible', resultTitle: string, fields: Field[], baseline: Rule & {label: string, source: Link}, alternatives: Alternative[], method: string, example?: string, sources?: Link[]}} Simulator
 */

/** @type {Simulator[]} */
export const householdSimulators = [
  {
    id: 'temps-de-travail',
    title: 'Temps de travail',
    icon: 'travail',
    summary: 'Comparer les durées hebdomadaires proposées.',
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
    ],
    sources: [
      { title: 'DGEC · prix TTC au 20 novembre 2026, page 6', url: fuelNote },
    ],
    method:
      'Chaque scénario conserve le volume et s’applique séparément. La comparaison retranche 40 centimes par litre aux objectifs de baisse, en supposant un effet intégral à la pompe. Pour la TVA, elle divise le prix saisi par 1,20 puis applique 5,5 % sur la même base. Ces calculs ne prévoient ni les marges des stations ni les prix futurs.',
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
    method:
      'Le scénario suppose les conditions de résidence et de séjour remplies en métropole. Il compare le seuil d’enfants et les conditions de nationalité que les textes précisent, à autres conditions constantes. Pour Saforcada, le résultat concerne la nouvelle allocation proposée. Les montants dépendent des barèmes et des ressources.',
  },
];

const brackets = [
  [8072, 5],
  [12109, 10],
  [15932, 15],
  [552324, 20],
  [902838, 30],
  [1805677, 40],
  [Infinity, 45],
];

function inheritanceTax(share) {
  const taxable = Math.max(0, share - 100_000);
  let cents = 0;
  let previous = 0;
  for (const [upper, rate] of brackets) {
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
    if (row.value === undefined) return Math.round((cents * 1055) / 1200);
    return Math.round(cents - litres * row.value);
  },
  loyers: ({ rent, previous, next }, row) =>
    Math.round(rent * (row.value ?? next / previous) * 100),
  successions: ({ share }, row, baseline) =>
    baseline ? inheritanceTax(share) : row.value,
  'allocations-familiales': ({ children, nationality }, row) =>
    children >= row.value && nationality >= (row.nationality ?? 0),
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
