// PUBBLICAZIONE AUTOMATICA
// Uso: npm run publish                 (pubblica fino a 100 bozze DI QUALITÀ)
//      npm run publish -- --max=50
//      npm run publish -- --all        (include anche le bozze dal solo titolo — sconsigliato)
//
// Pubblica in automatico le candidate che hanno una bozza scritta DALLA FONTE
// (filtro qualità: niente articoli basati sul solo titolo, salvo --all).
// Gli articoli senza testo non vengono MAI pubblicati.

import { readFile, writeFile, readdir, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = path.join(ROOT, 'pipeline', 'candidates');
const APPROVED = path.join(ROOT, 'pipeline', 'approved');
const NEWS = path.join(ROOT, 'src', 'content', 'news');

const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX = Math.max(1, Number(maxArg?.split('=')[1]) || 100);
const ALL = process.argv.includes('--all');

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function y(s) { return `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }

let files = [];
try { files = (await readdir(CANDIDATES)).filter((f) => f.endsWith('.json')); } catch {}

const queue = [];
for (const f of files) {
  try { queue.push({ f, c: JSON.parse(await readFile(path.join(CANDIDATES, f), 'utf8')) }); } catch {}
}

const eligible = queue
  .filter(({ c }) => {
    const d = c.draft;
    if (!d || !d.bodyIt || d.bodyIt.trim().length < 40) return false; // mai senza testo
    return ALL || d._fromSource || c.isDigest;
  })
  .sort((a, b) => b.c.score - a.c.score)
  .slice(0, MAX);

if (!eligible.length) {
  console.log('Nessuna bozza pubblicabile in coda.');
  console.log('Flusso: npm run collect → npm run write → npm run publish');
  console.log('(il filtro qualità pubblica solo bozze scritte dalla fonte; --all per forzare)');
  process.exit(0);
}

await mkdir(NEWS, { recursive: true });
await mkdir(APPROVED, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
let done = 0;

for (const { f, c } of eligible) {
  const d = c.draft;
  const slug = slugify(c.title);
  const md = `---
title: ${y(c.title)}
titleEn: ${y(d.titleEn || c.title)}
excerpt: ${y(d.excerpt)}
excerptEn: ${y(d.excerptEn || d.excerpt)}
date: ${date}
category: ${c.category || 'news'}
players: [${(c.players ?? []).map(y).join(', ')}]
competitions: [${(c.competitions ?? []).map(y).join(', ')}]
source: ${y(c.source || '')}
sourceUrl: ${y(c.link || '')}
---

${d.bodyIt.trim()}

<!--EN-->

${(d.bodyEn || d.bodyIt).trim()}
`;
  await writeFile(path.join(NEWS, `${slug}.md`), md);
  await rename(path.join(CANDIDATES, f), path.join(APPROVED, f));
  done++;
}

console.log(`✅ Pubblicati ${done} articoli (filtro qualità: ${ALL ? 'DISATTIVATO (--all)' : 'solo bozze dalla fonte'}).`);
console.log('   Controlla il sito con npm run dev — sei sempre in tempo a cancellare un file da src/content/news/.');
