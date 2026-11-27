import type { DocumentedPoll } from './data';

type Fact = {
  label: string;
  value: string;
  link?: { label: string; href: string };
  wide?: boolean;
};

export function pollMethodFacts(
  poll: DocumentedPoll,
  date: (value: string) => string,
): Fact[] {
  const publication = poll.firstPublication;
  const first = publication?.status === 'verifiee' ? publication : null;
  return [
    {
      label: 'Institut / commanditaire',
      value: `${poll.institute} / ${poll.commissioner}`,
    },
    {
      label: 'Terrain',
      value: `Du ${date(poll.fieldworkStart)} au ${date(poll.fieldworkEnd)}`,
    },
    {
      label: 'Date de référence de l’enquête',
      value: poll.published ? date(poll.published) : 'Publication non datée',
    },
    {
      label: 'Première diffusion',
      value: first
        ? `${first.media} · ${date(first.date)}${first.localTime ? ' à ' + first.localTime : ''}`
        : 'Média et date non établis.',
      link: first
        ? { label: `Notice, p. ${first.page}`, href: first.sourceUrl }
        : undefined,
    },
    {
      label: 'Échantillon global',
      value: `${poll.sampleSize.toLocaleString('fr-FR')} personnes, dont ${poll.registeredSample.toLocaleString('fr-FR')} inscrits`,
    },
    {
      label: 'Effectif utile exprimé',
      value:
        poll.usefulSample?.toLocaleString('fr-FR') ??
        'Non précisé pour cette question',
    },
    {
      label: 'Collecte et population',
      value: `${poll.method} ${poll.population}`,
      wide: true,
    },
  ];
}

export function pollUncertainty(poll: DocumentedPoll) {
  const confidence = poll.margin.confidence;
  return [
    poll.uncertainty,
    confidence === null
      ? 'Niveau de confiance non précisé.'
      : `Niveau de confiance indiqué : ${confidence} %.`,
  ].join(' ');
}
