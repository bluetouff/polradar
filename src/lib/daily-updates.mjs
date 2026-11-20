import { z } from 'astro/zod';
export const families = {
  sondages: ['Notices de sondage', '/sondages/', 'sondages'],
  polymarket: ['Polymarket', '/marches-predictifs/', 'markets'],
  kalshi: ['Kalshi', '/marches-predictifs/', 'markets'],
  economie: ['Séries Eurostat', '/economie/', 'donnees'],
  arcom: ['Temps de parole Arcom', '/temps-de-parole/', 'microphone'],
  veille: ['Documents de campagne', '/veille/', 'veille'],
};
const text = z.string().min(1).max(650);
const stamp = z.iso.datetime({ offset: true });
const sourceCheck = z.strictObject({
  sourceId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  checkedAt: stamp,
  status: z.enum(['accessible', 'modifie', 'bloque', 'indisponible']),
});
const row = z.strictObject({
  id: z.enum(Object.keys(families)),
  checked: z.union([stamp, z.iso.date()]).nullable(),
  dataDate: text.nullable(),
  lastChange: stamp.nullable(),
  status: z.enum(['verified', 'partial', 'unavailable']),
  periods: z.array(text).max(100).optional(),
  changes: z.array(text).max(1500),
  review: z.array(text).max(1500),
  incidents: z.array(text).max(1500),
});
export const dailyHistorySchema = z
  .array(
    z.strictObject({
      run: z.string().regex(/^[1-9]\d{0,15}$/),
      attempt: z.number().int().min(1),
      at: stamp,
      sourceChecks: z.array(sourceCheck).max(2000).optional(),
      rows: z.array(row).length(Object.keys(families).length),
    }),
  )
  .max(32)
  .superRefine((history, ctx) => {
    const runs = new Set();
    let previous = Infinity;
    for (const item of history) {
      const instant = Date.parse(item.at),
        key = item.run + '/' + item.attempt;
      if (
        runs.has(key) ||
        instant > previous ||
        (item.sourceChecks &&
          (new Set(item.sourceChecks.map((c) => c.sourceId)).size !==
            item.sourceChecks.length ||
            item.sourceChecks.some(
              (c) => Date.parse(c.checkedAt) > instant,
            ))) ||
        new Set(item.rows.map((r) => r.id)).size !== item.rows.length ||
        item.rows.some(
          (r) => r.lastChange && Date.parse(r.lastChange) > instant,
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Chronologie ou familles du journal incohérentes',
        });
      runs.add(key);
      previous = instant;
    }
  });
