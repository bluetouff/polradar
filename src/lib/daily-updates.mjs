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
  lastSuccessAt: stamp.optional(),
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
      scope: z.literal('sondages').optional(),
      rows: z.array(row).min(1).max(Object.keys(families).length),
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
        (item.scope === 'sondages'
          ? item.rows.length !== 1 ||
            item.rows[0].id !== 'sondages' ||
            Boolean(item.sourceChecks?.length)
          : item.rows.length !== Object.keys(families).length) ||
        (item.sourceChecks &&
          (new Set(item.sourceChecks.map((c) => c.sourceId)).size !==
            item.sourceChecks.length ||
            item.sourceChecks.some(
              (c) =>
                Date.parse(c.checkedAt) > instant ||
                (c.lastSuccessAt &&
                  Date.parse(c.lastSuccessAt) > Date.parse(c.checkedAt)),
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

/** @param {z.infer<typeof sourceCheck>[]} checks */
export function sourceFreshness(checks) {
  /** @type {Map<string,{sourceId:string,checkedAt:string,status:z.infer<typeof sourceCheck>['status'],lastSuccessAt:string|null}>} */
  const result = new Map();
  for (const row of checks) {
    const old = result.get(row.sourceId);
    const success = ['accessible', 'modifie'].includes(row.status)
      ? row.checkedAt
      : (row.lastSuccessAt ?? null);
    const lastSuccessAt =
      !old?.lastSuccessAt ||
      (success && Date.parse(success) > Date.parse(old.lastSuccessAt))
        ? success
        : old.lastSuccessAt;
    const attempt =
      !old || Date.parse(row.checkedAt) > Date.parse(old.checkedAt) ? row : old;
    result.set(row.sourceId, {
      sourceId: row.sourceId,
      checkedAt: attempt.checkedAt,
      status: attempt.status,
      lastSuccessAt,
    });
  }
  return result;
}
