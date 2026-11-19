import { z } from 'astro/zod';
import { idSchema } from './schema.mjs';

const text = z.string().trim().min(1).max(700);

export const positionsSchema = z
  .array(
    z.strictObject({
      id: idSchema,
      theme: idSchema,
      label: text,
      context: text,
      positions: z
        .array(
          z.strictObject({
            id: idSchema,
            label: text,
            versions: z.array(idSchema).min(1).max(33),
          }),
        )
        .min(2)
        .max(8),
    }),
  )
  .min(1)
  .max(40);

export function validateDivergencePositions(topics, dataset, reservedIds = []) {
  const errors = [];
  const themes = new Set(dataset.themes.map(({ id }) => id));
  const candidates = new Set(dataset.candidates.map(({ id }) => id));
  const versions = new Map(
    dataset.versions.map((version) => [version.id, version]),
  );
  const measures = new Map(
    dataset.measures.map((measure) => [measure.id, measure]),
  );
  const sources = new Map(dataset.sources.map((source) => [source.id, source]));
  const seenIds = new Set(reservedIds);
  for (const topic of topics) {
    if (seenIds.has(topic.id) || !themes.has(topic.theme)) {
      errors.push(
        `${topic.id} : axe de divergences dupliqué ou thème inconnu.`,
      );
    }
    seenIds.add(topic.id);
    const positionIds = new Set();
    const profiles = new Set();
    for (const position of topic.positions) {
      if (positionIds.has(position.id))
        errors.push(`${topic.id} : position dupliquée.`);
      positionIds.add(position.id);
      for (const versionId of position.versions) {
        const version = versions.get(versionId);
        const measure = measures.get(version?.measureId);
        if (
          !measure ||
          !candidates.has(measure.candidate) ||
          version.snapshot.scope === 'archive' ||
          !version.snapshot.sourceRefs.some(({ sourceId }) =>
            ['campagne', 'parti', 'institution'].includes(
              sources.get(sourceId)?.kind,
            ),
          )
        ) {
          errors.push(
            `${topic.id} : version officielle indisponible (${versionId}).`,
          );
          continue;
        }
        const profile = version.snapshot.partyAuthor ?? measure.candidate;
        if (profiles.has(profile)) {
          errors.push(
            `${topic.id} : profil rangé dans plusieurs positions (${profile}).`,
          );
        }
        profiles.add(profile);
      }
    }
  }
  return errors;
}
