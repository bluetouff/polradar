import type { APIRoute } from 'astro';
import { economy, economyCollectedAt } from '../../lib/economy-data';

export const GET: APIRoute = () => {
  const rows = economy.flatMap((series) =>
    series.observations.map(([period, value, flag]) =>
      [
        series.id,
        'FR',
        series.frequency,
        period,
        value ?? '',
        series.unit,
        flag,
        series.dataset,
        series.updatedAt,
        economyCollectedAt,
      ].join(';'),
    ),
  );
  return new Response(
    [
      'serie;territoire;frequence;periode;valeur;unite;statut;jeu_eurostat;jeu_mis_a_jour;collecte',
      ...rows,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/csv; charset=utf-8' } },
  );
};
