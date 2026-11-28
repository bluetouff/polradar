import { sruRateLabel, sruRateValue, type Sru } from './dossiers-territoriaux';

export function sruReading(row: Sru) {
  const value = sruRateValue(row.rate);
  const comparable =
    value !== null || (row.rate === '>25%' && row.target <= 25);
  const inScope = row.inScope === true;
  const below = inScope && value !== null && value < row.target;
  let status = 'Comparaison indisponible';
  if (row.inScope === false)
    status = 'Hors du périmètre SRU au 1ᵉʳ janvier 2026';
  if (inScope && comparable) {
    if (value === row.target) status = 'Au seuil indiqué';
    else if (below)
      status = row.exempt ? 'Sous le seuil indiqué' : 'Sous l’objectif';
    else
      status = row.exempt
        ? 'Au-dessus du seuil indiqué'
        : 'Au-dessus de l’objectif';
  }

  // Garder le même axe jusqu’à 50 %, puis l’étendre pour les taux atypiques.
  const end = Math.max(
    50,
    Math.ceil(Math.max(value ?? 0, row.target) / 25) * 25,
  );
  const scale =
    inScope && value !== null
      ? {
          end: end + ' %',
          width: (value / end) * 100,
          marker: (row.target / end) * 100,
        }
      : null;
  return {
    rate: sruRateLabel(row.rate),
    exact: value !== null,
    status,
    below,
    scale,
    target: row.target + ' %',
    targetLabel:
      inScope && !row.exempt
        ? 'Objectif indiqué'
        : 'Seuil indiqué dans le fichier',
    exempt: row.exempt === true,
  };
}
