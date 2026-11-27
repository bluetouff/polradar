import { z } from 'astro/zod';
import { publicUrlSchema } from './schema.mjs';

export const marketFeeds = {
  polymarket:
    'https://gamma-api.polymarket.com/events/slug/next-french-presidential-election',
  kalshi:
    'https://external-api.kalshi.com/trade-api/v2/events/KXFRENCHPRES-27?with_nested_markets=true',
};
const timestamp = z.iso.datetime({ offset: true });
const price = z.number().min(0).max(1).nullable();
const quantity = z.number().nonnegative().max(1e18).nullable();
const contractSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,150}$/),
  label: z.string().min(1).max(200),
  question: z.string().min(1).max(500),
  bid: price,
  ask: price,
  lastPrice: price,
  updatedAt: timestamp.nullable(),
  volume: quantity,
  liquidity: quantity,
  rules: z.string().max(20001),
});
const providerSchema = z
  .object({
    id: z.enum(['polymarket', 'kalshi']),
    eventId: z.string().regex(/^[A-Za-z0-9-]{1,150}$/),
    title: z.string().min(1).max(500),
    url: publicUrlSchema,
    apiUrl: publicUrlSchema,
    observedAt: timestamp,
    status: z.enum(['available', 'unavailable']),
    error: z.enum(['source-unavailable-or-invalid']).nullable(),
    volumeUnit: z.enum(['dollars', 'contrats']),
    volume: quantity,
    rules: z.string().min(1).max(10000),
    contracts: z.array(contractSchema).max(250),
  })
  .superRefine((provider, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    if (provider.apiUrl !== marketFeeds[provider.id]) fail('Flux non autorisé');
    if (provider.id === 'kalshi' && provider.eventId !== 'KXFRENCHPRES-27')
      fail('Événement incorrect');
    const expectedUrl =
      provider.id === 'polymarket'
        ? 'https://polymarket.com/event/next-french-presidential-election'
        : marketFeeds.kalshi;
    if (
      provider.url !== expectedUrl &&
      !(provider.status === 'unavailable' && provider.url === provider.apiUrl)
    )
      fail('Lien de marché non autorisé');
    if (
      provider.volumeUnit !==
      (provider.id === 'polymarket' ? 'dollars' : 'contrats')
    )
      fail('Unité de volume incorrecte');
    if (Date.parse(provider.observedAt) > Date.now() + 60000)
      fail('Relevé futur');
    if (provider.status === 'unavailable') {
      if (
        provider.contracts.length ||
        provider.volume !== null ||
        provider.error === null
      )
        fail('Une source indisponible ne contient aucune cotation');
    } else if (!provider.contracts.length || provider.error !== null)
      fail('Contrats manquants ou état incohérent');
    if (
      new Set(provider.contracts.map((row) => row.id)).size !==
      provider.contracts.length
    )
      fail('Contrat dupliqué');
    for (const row of provider.contracts) {
      for (const quote of [row.bid, row.ask])
        if (quote !== null && (quote <= 0 || quote >= 1))
          fail('Une borne vide ne constitue pas une cotation');
      if (row.bid !== null && row.ask !== null && row.bid > row.ask)
        fail('Carnet croisé');
      if (
        row.updatedAt &&
        Date.parse(row.updatedAt) > Date.parse(provider.observedAt)
      )
        fail('Modification après le relevé');
    }
  });
export const marketSnapshotSchema = z
  .object({
    version: z.literal(1),
    providers: z.array(providerSchema).length(2),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.providers.map((row) => row.id)).size !== 2)
      ctx.addIssue({ code: 'custom', message: 'Plateforme dupliquée' });
  });

/** A quote is a midpoint of available bids and asks, never a poll or a forecast. */
export function marketMidpoint(row) {
  return row.bid === null || row.ask === null ? null : (row.bid + row.ask) / 2;
}
export function marketPercent(value) {
  if (value === null) return 'Indisponible';
  if (value > 0 && value < 0.0001) return '< 0,01 %';
  return `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}
export function rankedContracts(rows) {
  return [...rows].sort((a, b) => {
    const left = marketMidpoint(a),
      right = marketMidpoint(b);
    if (left === null && right === null)
      return a.label.localeCompare(b.label, 'fr');
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left || a.label.localeCompare(b.label, 'fr');
  });
}

/** @param {z.infer<typeof providerSchema>[]} providers */
export function leadingMarketQuotes(providers) {
  /** @type {Map<string, Map<z.infer<typeof providerSchema>['id'], number | null>>} */
  const contracts = new Map();
  for (const provider of providers) {
    if (provider.status !== 'available') continue;
    for (const row of provider.contracts) {
      const label = row.label.trim();
      const prices = contracts.get(label) ?? new Map();
      // Pair identical labels only. A duplicate label has no unique quote.
      prices.set(
        provider.id,
        prices.has(provider.id) ? null : marketMidpoint(row),
      );
      contracts.set(label, prices);
    }
  }
  return Array.from(contracts, ([label, prices]) => ({
    label,
    highest: Math.max(
      -1,
      ...Array.from(prices.values()).filter((price) => price !== null),
    ),
    quotes: providers.map(({ id }) => ({
      provider: id,
      price: prices.get(id) ?? null,
    })),
  }))
    .filter(({ highest }) => highest >= 0)
    .sort(
      (a, b) => b.highest - a.highest || a.label.localeCompare(b.label, 'fr'),
    )
    .slice(0, 5);
}
