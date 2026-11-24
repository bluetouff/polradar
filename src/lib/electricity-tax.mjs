// TTC cents per MWh from the CRE residential Base CSV, row starting 01/08/2026.
// The regulator's reference volumes (2.2 and 4.0 MWh) are examples, not forecasts.
export const electricityProfiles = [
  { kva: 6, referenceKwh: 2200, centsPerMwh: 20010 },
  { kva: 9, referenceKwh: 4000, centsPerMwh: 19850 },
];
export const electricitySources = {
  tariffs:
    'https://www.cre.fr/documents/open-data/historique-des-tarifs-reglementes-de-vente-delectricite-pour-les-consommateurs-residentiels.html',
  csv: 'https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_Base.csv',
  profiles:
    'https://www.cre.fr/fileadmin/Documents/Rapports_et_etudes/2026/Rapport_Coherence_des_offres_2026.pdf',
  vat: 'https://entreprendre.service-public.gouv.fr/vosdroits/F37826',
  excise:
    'https://www.cre.fr/actualites/toute-lactualite/la-cre-propose-une-evolution-du-niveau-moyen-des-tarifs-reglementes-de-vente-de-lelectricite-de-25-ttc-au-1er-aout-2026.html',
};
const standardVatPermille = 200;
const referenceExciseCentsPerMwh = 3062;
export const electricityPolicies = [
  {
    author: 'Équinoxe',
    measure: 'mikolajczak-fiscalite-accise-electricite',
    source: 'equinoxe-contre-budget-2027',
    label: 'Accise à 12,04 €/MWh',
    status: 'Contre-budget du parti pour 2027',
    exciseCentsPerMwh: 1204,
  },
  {
    author: 'Selma Labib',
    measure: 'labib-fiscalite-tva-progressivite',
    source: 'labib-lettre-finances-2026',
    label: 'Suppression de la TVA',
    status: 'Lettre de campagne publiée le 26 octobre 2026',
    vatPermille: 0,
  },
  {
    author: 'Marine Le Pen',
    measure: 'lepen-climat-tva-energie',
    source: 'an-lepen-i635-tva-energies',
    label: 'TVA à 5,5 %',
    status: 'Amendement rejeté le 2 novembre 2026',
    vatPermille: 55,
  },
];

// Whole kWh in the form, cents only at the end. An upper bound keeps the
// integer products safely below Number.MAX_SAFE_INTEGER.
export const maxAnnualKwh = 1_000_000;

export function electricityComparison(kva, kwh) {
  const profile = electricityProfiles.find((p) => p.kva === kva);
  if (!profile || !Number.isSafeInteger(kwh) || kwh < 0 || kwh > maxAnnualKwh)
    return null;
  const centsPerMwh = profile.centsPerMwh;
  const current = Math.round((kwh * centsPerMwh) / 1000);
  const alternatives = electricityPolicies.map((policy) => {
    // Each proposal modifies exactly one tax on the original tariff.
    // Accise is already in the VAT base. Replace it once before applying TVA.
    const amount =
      'vatPermille' in policy
        ? Math.round(
            (kwh * centsPerMwh * (1000 + policy.vatPermille)) /
              (1000 * (1000 + standardVatPermille)),
          )
        : Math.round(
            (kwh *
              (centsPerMwh * 1000 +
                (policy.exciseCentsPerMwh - referenceExciseCentsPerMwh) *
                  (1000 + standardVatPermille))) /
              1_000_000,
          );
    return { measure: policy.measure, amount, difference: current - amount };
  });
  return { current, alternatives };
}
