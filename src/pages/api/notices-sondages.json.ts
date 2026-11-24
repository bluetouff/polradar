import type { APIRoute } from 'astro';
import {
  commissionIndex,
  coverageLabels,
  noticeUrl,
} from '../../lib/poll-catalogue.mjs';
import { catalogue, noticeRows } from '../../lib/poll-catalogue-data';
export const GET: APIRoute = () =>
  Response.json({
    version: 1,
    index: commissionIndex,
    checkedAt: catalogue.checkedAt,
    available: catalogue.available,
    lastSuccessAt: catalogue.lastSuccessAt,
    labels: coverageLabels,
    notices: noticeRows.map((row) => ({
      ...row,
      url: noticeUrl(row.downloadId),
    })),
  });
