import { z } from 'astro/zod';

export const commissionIndex =
  'https://www.commission-des-sondages.fr/notices/medias/fichiers/bytag/14/2027-Presidentielle';
const origin = new URL(commissionIndex).origin;
export const noticeUrl = (id) => origin + '/notices/medias/fichiers/add/' + id;
const timestamp = z.iso.datetime({ offset: true });
const entry = z.strictObject({
  downloadId: z.string().regex(/^[1-9][0-9]{0,6}$/),
  number: z
    .string()
    .regex(/^\d{4,6}[a-z]?$/)
    .nullable(),
  label: z
    .string()
    .min(1)
    .max(350)
    .regex(/^[^\u0000-\u001f\u007f]+$/),
  listedMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable(),
});
const rows = entry
  .array()
  .min(1)
  .max(3000)
  .refine(
    (r) => new Set(r.map((x) => x.downloadId)).size === r.length,
    'Identifiant Commission dupliqué',
  );
const check = z.strictObject({
  at: timestamp,
  reason: z.enum(['notice-inaccessible', 'format-non-reconnu']),
});
const backfill = z.strictObject({
  status: z.enum(['indisponible', 'format', 'lecture-requise', 'importe']),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
const attempts = z
  .array(
    backfill.extend({
      downloadId: entry.shape.downloadId,
      number: entry.shape.number.unwrap(),
    }),
  )
  .max(2)
  .refine(
    (records) =>
      new Set(records.map((r) => r.downloadId)).size === records.length,
  );
export const backfillLabels = {
  indisponible: 'Téléchargement impossible',
  format: 'Format à examiner',
  'lecture-requise': 'PDF reçu, tableaux à vérifier',
  importe: 'Scénarios extraits, couverture à vérifier',
};
export const catalogueSchema = z
  .strictObject({
    version: z.literal(1),
    checkedAt: timestamp,
    lastSuccessAt: timestamp.nullable(),
    available: z.boolean(),
    rows: z
      .array(
        entry.extend({
          lastListedAt: timestamp,
          issue: check.optional(),
          backfill: backfill.extend({ at: timestamp }).optional(),
        }),
      )
      .max(3000),
  })
  .superRefine((d, ctx) => {
    if (
      (d.lastSuccessAt &&
        Date.parse(d.lastSuccessAt) > Date.parse(d.checkedAt)) ||
      (d.available &&
        (!d.rows.length ||
          !d.lastSuccessAt ||
          Date.parse(d.lastSuccessAt) !== Date.parse(d.checkedAt))) ||
      (!d.lastSuccessAt && d.rows.length > 0) ||
      new Set(d.rows.map((r) => r.downloadId)).size !== d.rows.length ||
      d.rows.some(
        (r) =>
          Date.parse(r.lastListedAt) > Date.parse(d.lastSuccessAt ?? '') ||
          (r.issue && Date.parse(r.issue.at) > Date.parse(d.checkedAt)) ||
          (r.backfill && Date.parse(r.backfill.at) > Date.parse(d.checkedAt)),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Chronologie du catalogue invalide',
      });
  });

export function mergeCatalogue(previous, report) {
  const when = timestamp.parse(report.checkedAt);
  if (previous && Date.parse(when) < Date.parse(previous.checkedAt))
    throw Error('Relevé du catalogue antérieur');
  if (report.status === 'unavailable')
    return catalogueSchema.parse({
      version: 1,
      checkedAt: when,
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      available: false,
      rows: previous?.rows ?? [],
    });
  if (report.status !== 'available') throw Error('État du catalogue inconnu');
  const seen = rows.parse(report.catalogue);
  const old = new Map((previous?.rows ?? []).map((r) => [r.downloadId, r]));
  const issues = new Map(
    (report.review ?? [])
      .filter((r) =>
        ['notice-inaccessible', 'format-non-reconnu'].includes(r.reason),
      )
      .map((r) => [r.url, r.reason]),
  );
  const history = new Map();
  for (const attempt of attempts.parse(report.backfill ?? [])) {
    const { downloadId, number, status, sha256 } = attempt;
    if (
      !seen.some((r) => r.downloadId === downloadId && r.number === number) ||
      (['lecture-requise', 'importe'].includes(status) && !sha256)
    )
      throw Error('Tentative de rattrapage incohérente avec le catalogue');
    history.set(downloadId, {
      at: when,
      status,
      ...(sha256 ? { sha256 } : {}),
    });
  }
  const imported = new Set((report.sources ?? []).map((r) => r.url));
  for (const row of seen) {
    const url = noticeUrl(row.downloadId),
      issue = issues.get(url);
    const prior = old.get(row.downloadId);
    const same =
      prior &&
      prior.number === row.number &&
      prior.label === row.label &&
      prior.listedMonth === row.listedMonth;
    const attempt = history.get(row.downloadId);
    const previousIssue =
      same && !imported.has(url) && !attempt ? prior.issue : undefined;
    const historic = attempt ?? (same ? prior.backfill : undefined);
    old.set(row.downloadId, {
      ...row,
      lastListedAt: when,
      ...(historic ? { backfill: historic } : {}),
      ...(issue
        ? { issue: { reason: issue, at: when } }
        : previousIssue
          ? { issue: previousIssue }
          : {}),
    });
  }
  return catalogueSchema.parse({
    version: 1,
    checkedAt: when,
    lastSuccessAt: when,
    available: true,
    rows: [...old.values()].sort(
      (a, b) => Number(b.downloadId) - Number(a.downloadId),
    ),
  });
}

export const coverageLabels = {
  integree: 'Tous les scénarios vérifiés',
  hors_series: 'Enquêtes à périmètre particulier',
  partielle: 'Scénarios publiés, couverture à vérifier',
  a_relire: 'Intentions de vote à dépouiller',
  identifiee: 'Objet à vérifier',
  non_pertinente: 'Hors intentions de vote',
  format: 'Format à relire',
  inaccessible: 'Notice inaccessible',
};
const auditSchema = z.record(
  z.string().regex(/^[1-9][0-9]{0,6}$/),
  z
    .strictObject({
      number: z.string().regex(/^\d{4,6}[a-z]?$/),
      checked: z.iso.date(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      pages: z.array(z.number().int().min(1).max(1000)).max(300),
      scenarios: z
        .array(
          z.strictObject({
            id: z
              .string()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .max(100),
            page: z.number().int().min(1).max(1000),
          }),
        )
        .max(300),
      reason: z.string().min(1).max(400),
      evidencePages: z
        .array(z.number().int().min(1).max(1000))
        .min(1)
        .max(300)
        .refine((pages) => new Set(pages).size === pages.length)
        .optional(),
      outsideSeries: z.literal(true).optional(),
    })
    .refine((a) => {
      const pages = new Set(a.scenarios.map((s) => s.page));
      return (
        (!a.outsideSeries ||
          (a.scenarios.length === 0 && a.evidencePages !== undefined)) &&
        pages.size === a.pages.length &&
        a.pages.every((p) => pages.has(p)) &&
        new Set(a.pages).size === a.pages.length &&
        new Set(a.scenarios.map((s) => s.id)).size === a.scenarios.length
      );
    }, 'Scénarios et pages de relecture incohérents'),
);
/**
 * @param {z.infer<typeof catalogueSchema>} snapshot
 * @param {{id:string,noticeSource:string,noticePage:number}[]} polls
 * @param {{id:string,url:string}[]} sources
 * @param {unknown} rawAudits
 */
export function catalogueCoverage(snapshot, polls, sources, rawAudits) {
  const audits = auditSchema.parse(rawAudits);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const byNumber = new Map();
  const byPath = new Map();
  for (const p of polls) {
    const s = sourceById.get(p.noticeSource);
    if (!s) throw Error('Référence de notice absente : ' + p.noticeSource);
    const u = new URL(s.url);
    if (u.origin !== origin) continue;
    const id = /^\/notices\/medias\/fichiers\/add\/([1-9]\d*)$/.exec(
      u.pathname,
    )?.[1];
    const number = /^\/notices\/files\/notices\/\d{4}\/[^/]+\/(\d{4,6}[a-z]?)-/i
      .exec(u.pathname)?.[1]
      ?.toLowerCase();
    const map = id ? byPath : byNumber,
      key = id ?? number;
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ id: p.id, page: p.noticePage });
  }
  return snapshot.rows.map((r) => {
    const scenarios = [
      ...(byPath.get(r.downloadId) ?? []),
      ...(byNumber.get(r.number) ?? []),
    ];
    const audit = audits[r.downloadId];
    if (audit && audit.number !== r.number)
      throw Error('Numéro de notice incohérent avec la relecture');
    if (audit?.outsideSeries && scenarios.length)
      throw Error(
        'Une enquête hors série est présente dans les intentions nationales',
      );
    let status = 'identifiee';
    if (audit?.outsideSeries) status = 'hors_series';
    else if (scenarios.length) {
      const actual = new Map(scenarios.map((s) => [s.id, s.page]));
      const verified =
        audit &&
        audit.scenarios.length === scenarios.length &&
        audit.scenarios.every((s) => actual.get(s.id) === s.page);
      status = verified ? 'integree' : 'partielle';
    } else if (audit && !audit.pages.length) status = 'non_pertinente';
    else if (r.backfill?.status === 'indisponible') status = 'inaccessible';
    else if (r.backfill?.status === 'format') status = 'format';
    else if (r.backfill?.status === 'lecture-requise') status = 'a_relire';
    else if (r.issue?.reason === 'notice-inaccessible') status = 'inaccessible';
    else if (r.issue?.reason === 'format-non-reconnu') status = 'format';
    else if (/\bIV\b|intentions? de vote/i.test(r.label)) status = 'a_relire';
    return { ...r, status, scenarios, audit: audit ?? null };
  });
}
