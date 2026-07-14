import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string(),
    excerpt: z.string(),
    excerptEn: z.string(),
    date: z.coerce.date(),
    category: z.enum(['news', 'performance', 'mercato', 'editoriale', 'taccuino']),
    players: z.array(z.string()).default([]),
    /** ID delle competizioni collegate (vedi data/competitions.json), es. ["euro-u19-2026"] */
    competitions: z.array(z.string()).default([]),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    /** URL o percorso (in /public) di una foto per l'articolo. Se assente, viene generata una copertina. */
    image: z.string().optional(),
  }),
});

export const collections = { news };
