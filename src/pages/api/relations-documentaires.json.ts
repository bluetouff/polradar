import { sourceCommit } from '../../../scripts/release-revision.mjs';
import { meta } from '../../lib/data';
import { documentaryRelations } from '../../lib/documentary-relations';

export function GET() {
  return Response.json({
    version: 1,
    sourceCommit,
    edition: meta.edition,
    relations: documentaryRelations,
  });
}
