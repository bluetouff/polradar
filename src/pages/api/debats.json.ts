import { sourceCommit } from '../../../scripts/release-revision.mjs';
import { debateEvidence } from '../../lib/debate-evidence';

export function GET() {
  return Response.json({ version: 1, sourceCommit, items: debateEvidence });
}
