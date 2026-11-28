export const sruSource =
  'https://www.data.gouv.fr/datasets/communes-et-inventaire-sru';
export const sruFile =
  'https://static.data.gouv.fr/resources/communes-et-inventaire-sru/20260811-123753/donnees-sru-data-gouv-2026.csv';
export const sruLaw =
  'https://www.ecologie.gouv.fr/politiques-publiques/larticle-55-loi-solidarite-renouvellement-urbain-sru';
export const aplSource =
  'https://drees.solidarites-sante.gouv.fr/communique-de-presse-jeux-de-donnees/jeux-de-donnees/260722-accessibilite-aux-soins-de-premier-recours-en-2024';
export const aplFile =
  'https://data.drees.solidarites-sante.gouv.fr/api/explore/v2.1/catalog/datasets/530_l-accessibilite-potentielle-localisee-apl/attachments/indicateur_d_apl_aux_medecins_generalistes_xlsx';
export const sruPage = '/questions/logement-obligations-parc-social/';
export const aplPage = '/questions/sante-installation-medecins/';
export type Sru = {
  inventory: number | null;
  rate: string | null;
  target: number;
  inScope: boolean | null;
  deficit: boolean | null;
  carence: boolean | null;
  exempt: boolean | null;
};
export type Indicator = 'sru' | 'apl';
export const aplNumber = (n: number, digits = 2) =>
  n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const aplBins = [
  { label: 'Moins de 3', short: '< 3', level: 'Accès faible', fill: '#c1dfe1' },
  {
    label: '3 à moins de 4',
    short: '3 à < 4',
    level: 'Accès intermédiaire bas',
    fill: '#73b2b8',
  },
  {
    label: '4 à moins de 5',
    short: '4 à < 5',
    level: 'Accès intermédiaire haut',
    fill: '#287b88',
  },
  { label: '5 ou plus', short: '≥ 5', level: 'Accès élevé', fill: '#123e52' },
];

export function aplBand(value: number) {
  return value < 3 ? 0 : value < 4 ? 1 : value < 5 ? 2 : 3;
}

export function aplReading(value: number) {
  const index = aplBand(value);
  const { label, level } = aplBins[index];
  // Garder le millième lorsqu’un arrondi au centième franchit un seuil.
  const digits = index < 3 && value >= 3 + index - 0.005 ? 3 : 2;
  return {
    index,
    number: aplNumber(value, digits),
    category: level + ' · ' + label.toLowerCase(),
  };
}

export const aplTerritoryLabel = (code: string) =>
  ['75056', '13055', '69123'].includes(code)
    ? 'Moyenne des arrondissements, pondérée par la population standardisée.'
    : 'Valeur communale ou d’arrondissement publiée par la DREES.';

export function sruRateValue(rate: Sru['rate']) {
  const numeric = rate?.match(/^(\d+(?:,\d+)?)%$/);
  const value = numeric ? Number(numeric[1].replace(',', '.')) : NaN;
  return Number.isFinite(value) ? value : null;
}

export const sruRateLabel = (rate: Sru['rate']) =>
  rate === '>25%'
    ? 'Plus de 25 %'
    : (rate?.replace('%', ' %') ?? 'Non renseigné');

export function sruFacts(
  data: Sru | undefined,
  withComparison = true,
): [string, string][] {
  if (data === undefined)
    return [['Inventaire SRU', 'Commune absente du fichier ministériel.']];
  const bool = (v: boolean | null) =>
    v === null ? 'Non renseigné' : v ? 'Oui' : 'Non';
  const details: [string, string][] = [
    [
      'Logements sociaux inventoriés',
      data.inventory === null
        ? 'Inventaire non disponible'
        : data.inventory.toLocaleString('fr-FR'),
    ],
    ['Commune dans le dispositif · 1ᵉʳ janvier 2026', bool(data.inScope)],
    ['Commune déficitaire · 1ᵉʳ janvier 2025', bool(data.deficit)],
    ['Carence · 2023 à 2025', bool(data.carence)],
    ['Exemption · 2026 à 2028', bool(data.exempt)],
  ];
  if (withComparison)
    details.unshift(
      [
        'Part de logements sociaux · 1ᵉʳ janvier 2025',
        sruRateLabel(data.rate).replace(' %', '\u00a0%'),
      ],
      ['Objectif indiqué dans le fichier', data.target + '\u00a0%'],
    );
  return details;
}
export const healthMeasures: Record<string, [string, string]> = {
  'melenchon-sante-2': [
    'Médecins qui s’installent et médecins publics à recruter.',
    'Le programme prévoit un guichet unique pour les démarches. L’autorité chargée d’accorder les installations reste à préciser.',
  ],
  'branco-sante-implantation-medicale': [
    'Médecins appelés à exercer en zone sous-dotée et futurs médecins d’État.',
    'Les centres départementaux piloteraient la lutte contre les déserts médicaux avec des antennes locales.',
  ],
  'mikolajczak-sante-installation': [
    'Médecins libéraux et étudiants en médecine entrant dans le contrat d’engagement de service public.',
    'Habitants, professionnels et élus seraient consultés pour définir les besoins prioritaires.',
  ],
  'ps-sante-installation-medecins': [
    'Médecins libéraux souhaitant s’installer.',
    'Dans une zone bien pourvue, le projet socialiste réserve l’installation aux remplacements et aux départs à la retraite. Le passage ne désigne pas l’autorité de décision.',
  ],
  'tondelier-sante-installation-medecins': [
    'Médecins libéraux demandant une installation.',
    'L’agence régionale de santé délivrerait l’autorisation. Elle serait de droit en zone sous-dotée et liée au départ d’un praticien ailleurs.',
  ],
  'retailleau-sante-installation-medecins': [
    'Médecins qui s’installent dans les territoires manquant de soins.',
    'La FAQ de campagne annonce une régulation. Le mécanisme et l’autorité de décision restent à préciser.',
  ],
  'lisnard-sante-1': [
    'Professionnels de santé concernés par le conventionnement.',
    'Le programme conserve la liberté d’installation et propose d’adapter le conventionnement au territoire.',
  ],
  'groupe-rn-sante-cumul-soignants': [
    'Personnels soignants retraités souhaitant poursuivre ou reprendre une activité.',
    'Le groupe RN propose de faciliter le cumul emploi-retraite. Cette mesure porte sur la poursuite de l’activité.',
  ],
};
