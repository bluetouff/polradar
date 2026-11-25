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
export const aplNumber = (n: number) =>
  n.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function localFacts(
  mode: Indicator,
  code: string,
  data: Sru | number | undefined,
): [string, string][] {
  if (data === undefined)
    return [
      [
        mode === 'sru' ? 'Inventaire SRU' : 'Accessibilité 2024',
        mode === 'sru'
          ? 'Commune absente du fichier ministériel.'
          : 'Aucune observation DREES pour ce code.',
      ],
    ];
  if (typeof data === 'number') {
    const largeCity = ['75056', '13055', '69123'].includes(code);
    return [
      [
        'Consultations accessibles par an et par habitant standardisé',
        aplNumber(data),
      ],
      [
        'Territoire',
        largeCity
          ? 'Moyenne des arrondissements, pondérée par la population standardisée.'
          : 'Valeur communale ou d’arrondissement publiée par la DREES.',
      ],
    ];
  }
  const bool = (v: boolean | null) =>
    v === null ? 'Non renseigné' : v ? 'Oui' : 'Non';
  const rate =
    data.rate === '>25%'
      ? 'Plus de 25\u00a0%'
      : (data.rate?.replace('%', '\u00a0%') ?? 'Non renseigné');
  return [
    ['Part de logements sociaux · 1ᵉʳ janvier 2025', rate],
    ['Objectif indiqué dans le fichier', data.target + '\u00a0%'],
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
