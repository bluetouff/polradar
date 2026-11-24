import calendar from '../data/fenetres-sondages.json' with { type: 'json' };

const official = new Set([
  'www.legifrance.gouv.fr',
  'www.conseil-constitutionnel.fr',
  'www.commission-des-sondages.fr',
  'www.interieur.gouv.fr',
]);
function instant(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  )
    throw Error('Horaire électoral invalide');
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().replace('.000Z', 'Z') !== value
  )
    throw Error('Horaire électoral invalide');
  return timestamp;
}

// A deployment includes immutable embeds and news copy as well as survey data.
// During a confirmed window, keep the edition reviewed before the cutoff.
export function checkPollPublication(now = new Date(), rules = calendar) {
  if (
    !(now instanceof Date) ||
    !Number.isFinite(+now) ||
    rules.version !== 1 ||
    !Array.isArray(rules.fenetres)
  )
    throw Error('Calendrier de publication invalide');
  let paused = false;
  for (const window of rules.fenetres) {
    const start = instant(window.debut),
      end = instant(window.fin);
    const source = new URL(window.source);
    if (
      end <= start ||
      source.protocol !== 'https:' ||
      !official.has(source.hostname) ||
      source.username ||
      source.password ||
      source.port ||
      source.pathname === '/'
    )
      throw Error('Fenêtre électorale sans calendrier officiel vérifié');
    if (+now >= start && +now < end) paused = true;
  }
  if (paused)
    throw Error(
      'Livraison suspendue pendant la période électorale vérifiée. Consulter docs/publication-sondages.md.',
    );
}
