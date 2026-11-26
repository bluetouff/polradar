import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  sourceSchema,
  candidateSchema,
  themeSchema,
  engagementSchema,
  eventSchema,
  pollSchema,
  dateSchema,
  measureSchema,
  versionSchema,
} from './lib/schema.mjs';
import sources from './data/sources.json';
import themes from './data/themes.json';
import events from './data/events.json';
const knownEvents = new Map(events.map((event) => [event.id, event]));
const knownSources = new Set(sources.map((source) => source.id));
const knownThemes = new Set(themes.map((theme) => theme.id));

export const collections = {
  measures: defineCollection({
    loader: file('src/data/measures.json'),
    schema: measureSchema,
  }),
  versions: defineCollection({
    loader: file('src/data/versions.json'),
    schema: versionSchema,
  }),
  candidates: defineCollection({
    loader: file('src/data/candidates.json'),
    schema: candidateSchema,
  }),
  themes: defineCollection({
    loader: file('src/data/themes.json'),
    schema: themeSchema,
  }),
  sources: defineCollection({
    loader: file('src/data/sources.json'),
    schema: sourceSchema,
  }),
  engagements: defineCollection({
    loader: file('src/data/engagements.json'),
    schema: engagementSchema,
  }),
  events: defineCollection({
    loader: file('src/data/events.json'),
    schema: eventSchema,
  }),
  polls: defineCollection({
    loader: file('src/data/polls.json'),
    schema: pollSchema,
  }),
  breves: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/breves' }),
    schema: z
      .object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        event: z
          .string()
          .refine((id) => knownEvents.has(id), 'Événement inconnu'),
        published: dateSchema,
        reperes: z
          .array(
            z.object({
              periode: z.string().min(1).max(45),
              fait: z.string().min(1).max(150),
            }),
          )
          .min(2)
          .max(5)
          .optional(),
        draft: z.boolean().default(false),
      })
      .refine((b) => {
        const event = knownEvents.get(b.event);
        return (
          !event ||
          (event.kind === 'announced' && event.dateKind === 'evenement') ||
          event.date <= b.published
        );
      }, 'Publication antérieure au fait relaté'),
  }),
  articles: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
    schema: z
      .object({
        title: z.string(),
        description: z.string(),
        category: z.enum(['Comprendre', 'Campagne', 'Méthode', 'Économie']),
        published: dateSchema,
        updated: dateSchema,
        sources: z
          .array(
            z.string().refine((id) => knownSources.has(id), 'Source inconnue'),
          )
          .min(1),
        themes: z.array(
          z.string().refine((id) => knownThemes.has(id), 'Thème inconnu'),
        ),
        featured: z.boolean().default(false),
        draft: z.boolean().default(false),
      })
      .refine(
        (article) => article.updated >= article.published,
        'Modification antérieure à la publication',
      ),
  }),
};
