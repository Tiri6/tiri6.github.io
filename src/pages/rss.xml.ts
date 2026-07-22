// Feed RSS delle pubblicazioni — https://italiannextgen.it/rss.xml
// È il "canale" che servizi come Make.com leggono per postare su Instagram.
// Include solo articoli già visibili (publishedAt passato) e, per ognuno,
// l'immagine social se esiste (public/social/<slug>.jpg).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { filterPublished, sortByPublished } from '../lib/articles';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://italiannextgen.it';

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: APIRoute = async () => {
  const posts = sortByPublished(filterPublished(await getCollection('news'))).slice(0, 30);

  const items = posts
    .map((p) => {
      const url = `${SITE}/news/${p.id}/`;
      const img = path.resolve(`public/social/${p.id}.jpg`);
      const hasImg = fs.existsSync(img);
      const pub = new Date(p.data.publishedAt ?? p.data.date).toUTCString();
      return `  <item>
    <title>${esc(p.data.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${pub}</pubDate>
    <description>${esc(p.data.excerpt)}</description>
    <category>${esc(p.data.category)}</category>${hasImg ? `
    <enclosure url="${SITE}/social/${p.id}.jpg" type="image/jpeg" length="0"/>` : ''}
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Italian Next Gen</title>
  <link>${SITE}</link>
  <description>Tutti i giovani calciatori italiani, ogni giorno. Obiettivo: Mondiale 2030.</description>
  <language>it</language>
${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
