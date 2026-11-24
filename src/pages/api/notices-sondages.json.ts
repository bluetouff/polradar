import type { APIRoute } from 'astro';
import { sourceCommit } from '../../../scripts/release-revision.mjs';
import {
  commissionIndex,
  coverageLabels,
  noticeUrl,
} from '../../lib/poll-catalogue.mjs';
import {
  catalogue,
  noticeRows,
  specialStudies,
} from '../../lib/poll-catalogue-data';
export const GET: APIRoute = () =>
  Response.json({
    version: 1,
    sourceCommit,
    index: commissionIndex,
    checkedAt: catalogue.checkedAt,
    available: catalogue.available,
    lastSuccessAt: catalogue.lastSuccessAt,
    labels: coverageLabels,
    specialStudies,
    notices: noticeRows.map((row) => ({
      ...row,
      url: noticeUrl(row.downloadId),
    })),
  });
