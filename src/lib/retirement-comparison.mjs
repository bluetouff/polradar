const metrics = [
  {
    id: 'depart',
    label: 'Âge de départ',
    detail: 'Âge légal actuel et âges annoncés',
    ticks: [60, 62, 64, 66, 68],
    multiplier: 12,
  },
  {
    id: 'duree',
    label: 'Durée d’assurance ou de cotisation',
    detail: 'En trimestres sur le graphique',
    ticks: [160, 165, 170, 175, 180],
    multiplier: 1,
  },
  {
    id: 'taux-plein',
    label: 'Taux plein sans durée requise',
    detail: 'Âge d’annulation de la décote',
    ticks: [60, 62, 64, 66, 68],
    multiplier: 12,
  },
];

export const retirementPath = '/comparer/retraites/';
export const retirementUrl = (id) =>
  id === '1969-et-apres' ? retirementPath : `${retirementPath}${id}/`;

export function formatAge(months) {
  const rest = months % 12;
  return `${Math.floor(months / 12)} ans${rest ? ` et ${rest} mois` : ''}`;
}

export function metricPosition(value, metric) {
  const min = metric.ticks[0] * metric.multiplier;
  const max = metric.ticks.at(-1) * metric.multiplier;
  if (value < min || value > max)
    throw new Error(`Valeur hors de l’axe ${metric.id}`);
  return (value - min) / (max - min);
}

export function retirementComparison(data, cohort, dataset) {
  const law = [cohort.ageMonths, cohort.quarters, data.automaticAgeMonths];
  /** @type {Array<{
   *   name: string,
   *   values: Array<{value: number, text: string} | null>,
   *   note: string,
   *   source: {url: string},
   *   detailSource?: {label: string, url: string},
   *   versionLink: string
   * }>} */
  const programmes = data.programmes.map((programme) => {
    const candidate = dataset.candidates.find(
      ({ id }) => id === programme.candidate,
    );
    const version = dataset.versions.find(
      ({ id }) => id === programme.versionId,
    );
    const measure = dataset.measures.find(
      ({ id }) => id === version?.measureId,
    );
    if (
      !candidate ||
      !version ||
      measure?.candidate !== candidate.id ||
      measure.theme !== 'retraites' ||
      version.snapshot.scope !== 'campagne'
    ) {
      throw new Error(`Version de programme invalide : ${programme.versionId}`);
    }
    const values = programme.metrics.map((key, index) => {
      if (key === null) return null;
      const metric = version.snapshot.metrics.find(
        (value) => value.key === key,
      );
      const unit = index === 1 ? 'annuités' : 'ans';
      if (
        !metric ||
        metric.unit !== unit ||
        !Number.isSafeInteger(metric.value) ||
        metric.value <= 0
      )
        throw new Error(
          `Métrique absente ou invalide : ${version.id} / ${key}`,
        );
      const source = dataset.sources.find(({ id }) => id === metric.sourceId);
      if (
        source?.kind !== 'campagne' ||
        !version.snapshot.sourceRefs.some(
          ({ sourceId }) => sourceId === source.id,
        )
      )
        throw new Error(`Source de campagne invalide : ${version.id} / ${key}`);
      return index === 1
        ? { value: metric.value * 4, text: `${metric.value} annuités`, source }
        : {
            value: metric.value * 12,
            text: formatAge(metric.value * 12),
            source,
          };
    });
    return {
      name: candidate.name,
      values,
      note: programme.note,
      source: values.find(Boolean).source,
      detailSource: programme.detailSource,
      versionLink: `/mesures/${measure.id}/#version-${version.number}`,
    };
  });
  const panels = metrics.map((metric, index) => ({
    ...metric,
    rows: [
      {
        name: 'Droit en vigueur',
        text: index === 1 ? `${law[index]} trimestres` : formatAge(law[index]),
        position: metricPosition(law[index], metric),
      },
      ...programmes.map(({ name, values }) => ({
        name,
        text: values[index]?.text ?? 'Non précisé',
        position:
          values[index] === null
            ? null
            : metricPosition(values[index].value, metric),
      })),
    ],
    marks: metric.ticks.map((value) => ({
      value,
      position: metricPosition(value * metric.multiplier, metric),
    })),
  }));
  return { programmes, panels };
}
