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

// --- Anti-duplicati: confronta le "parole significative" di titolo+sommario ---
const STOP = new Set(['il','lo','la','i','gli','le','un','uno','una','di','a','da','in','con','su','per','tra','fra','del','della','dei','delle','dello','al','alla','ai','alle','allo','e','ed','che','non','si','ha','hanno','più','dopo','ecco','cosa','come','anche','ma','nel','nella','sul','sulla','the','of','and','to','for','an','is','are']);
function sigWords(s) {
  return new Set(
    String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}
function overlap(a, b) {
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (Math.min(a.size, b.size) || 1);
}
const SIM_THRESHOLD = 0.62; // sopra questa soglia = notizia praticamente uguale

// Impronte degli articoli PUBBLICATI negli ultimi 4 giorni (per non ripubblicare)
const recentPrints = [];
try {
  const now = Date.now();
  for (const nf of (await readdir(NEWS)).filter((x) => x.endsWith('.md'))) {
    const t = await readFile(path.join(NEWS, nf), 'utf8');
    const fm = t.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const dstr = fm.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1];
    if (dstr && (now - new Date(dstr)) / 86400000 > 4) continue;
    const title = fm.match(/^title:\s*"(.*)"/m)?.[1] ?? '';
    const exc = fm.match(/^excerpt:\s*"(.*)"/m)?.[1] ?? '';
    const cat = fm.match(/^category:\s*["']?(\w+)/m)?.[1] ?? 'news';
    const pls = [...(fm.match(/^players:\s*\[(.*)\]/m)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    recentPrints.push({ w: sigWords(title + ' ' + exc), cat, players: new Set(pls) });
  }
} catch {}

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
let done = 0, skippedDup = 0;

// Impronte pubblicate in QUESTO giro (evita due doppioni di fila nello stesso batch)
const publishedNow = [];

for (const { f, c } of eligible) {
  const d = c.draft;
  // Titolo pulito scritto dal redattore; il titolo grezzo della fonte è solo un ripiego
  const cleanTitle = (d.title && d.title.trim().length > 5) ? d.title.trim() : c.title;

  // --- Salta se è una notizia quasi identica a una già uscita o appena pubblicata ---
  if (c.category !== 'taccuino') {
    const w = sigWords(cleanTitle + ' ' + (d.excerpt ?? ''));
    const pls = new Set(c.players ?? []);
    const samePlayer = (o) => [...pls].some((p) => o.players.has(p));
    const isDup = [...recentPrints, ...publishedNow].some(
      (o) => o.cat !== 'taccuino' && overlap(w, o.w) >= SIM_THRESHOLD && (o.cat === c.category || samePlayer(o) || pls.size === 0)
    );
    if (isDup) {
      await rename(path.join(CANDIDATES, f), path.join(APPROVED, f));
      skippedDup++;
      console.log(`  ⤫ doppione saltato: ${cleanTitle.slice(0, 60)}`);
      continue;
    }
    publishedNow.push({ w, cat: c.category, players: pls });
  }

  const slug = slugify(cleanTitle);
  const md = `---
title: ${y(cleanTitle)}
titleEn: ${y(d.titleEn || cleanTitle)}
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

console.log(`✅ Pubblicati ${done} articoli${skippedDup ? ` · ${skippedDup} doppioni saltati` : ''} (filtro qualità: ${ALL ? 'DISATTIVATO (--all)' : 'solo bozze dalla fonte'}).`);
console.log('   Controlla il sito con npm run dev — sei sempre in tempo a cancellare un file da src/content/news/.');
