import { z } from 'astro/zod';
import { dateSchema, publicUrlSchema } from './schema.mjs';

export const families = {
  1: 'Droite radicale',
  2: 'Conservateurs',
  3: 'Libéraux',
  5: 'Socialistes',
  6: 'Gauche radicale',
  7: 'Écologistes',
};

const score = z.number().min(0).max(10);
export const chesFranceSchema = z
  .strictObject({
    wave: z.literal(2024),
    country: z.literal(6),
    fieldworkStart: dateSchema,
    fieldworkEnd: dateSchema,
    source: publicUrlSchema,
    codebook: publicUrlSchema,
    csv: publicUrlSchema,
    publication: publicUrlSchema,
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    parties: z
      .array(
        z.strictObject({
          party_id: z.number().int().min(600).max(699),
          party: z.string().min(1),
          label: z.string().min(1),
          name: z.string().min(1),
          family: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(5),
            z.literal(6),
            z.literal(7),
          ]),
          lrecon: score,
          galtan: score,
          eu_position: z.number().min(1).max(7),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    if (
      new Set(data.parties.map((p) => p.party_id)).size !== data.parties.length
    )
      ctx.addIssue({ code: 'custom', message: 'Identifiant de parti répété' });
    if (data.fieldworkEnd < data.fieldworkStart)
      ctx.addIssue({ code: 'custom', message: 'Dates de terrain inversées' });
  });
