// REPORT DI COPERTURA
// Uso: npm run coverage
//
// Controlla che ogni giocatore della watchlist abbia articoli pubblicati e
// candidate in coda. Segnala chi è "scoperto" (< 2 articoli), così sai su chi
// puntare la prossima raccolta: `npm run collect -- --days=30` cerca nelle
// ultime N giornate e riempie i buchi.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEWS = path.join(ROOT, 'src', 'content', 'news');
const CANDIDATES = path.join(ROOT, 'pipeline', 'candidates');

const { players } = JSON.parse(await readFile(path.join(ROOT, 'data', 'players.json'), 'utf8'));

// Conta articoli pubblicati per giocatore (campo players nel frontmatter + citazioni nel testo)
const published = {};
let files = [];
try { files = (await readdir(NEWS)).filter((f) => f.endsWith('.md')); } catch {}
for (const f of files) {
  const text = await readFile(path.join(NEWS, f), 'utf8');
  for (const p of players) {
    const lastName = p.name.split(' ').pop();
    if (text.includes(p.name) || text.includes(lastName)) {
      published[p.name] = (published[p.name] ?? 0) + 1;
    }
  }
}

// Conta candidate in coda per giocatore
const queued = {};
let cands = [];
try { cands = (await readdir(CANDIDATES)).filter((f) => f.endsWith('.json')); } catch {}
for (const f of cands) {
  try {
    const c = JSON.parse(await readFile(path.join(CANDIDATES, f), 'utf8'));
    for (const name of c.players ?? []) queued[name] = (queued[name] ?? 0) + 1;
  } catch {}
}

const rows = players
  .map((p) => ({ name: p.name, club: p.club, art: published[p.name] ?? 0, coda: queued[p.name] ?? 0 }))
  .sort((a, b) => a.art - b.art || a.coda - b.coda);

const scoperti = rows.filter((r) => r.art < 2);
console.log(`🇮🇹 Copertura watchlist — ${players.length} giocatori, ${files.length} articoli pubblicati\n`);
console.log(`⚠️  Giocatori con meno di 2 articoli: ${scoperti.length}\n`);
for (const r of scoperti) {
  console.log(`  ${String(r.art).padStart(2)} articoli · ${String(r.coda).padStart(2)} in coda · ${r.name} (${r.club})`);
}
if (scoperti.length) {
  console.log('\n👉 Per riempire i buchi: npm run collect -- --days=30  (poi npm run review)');
} else {
  console.log('✅ Tutti i giocatori hanno almeno 2 articoli.');
}
