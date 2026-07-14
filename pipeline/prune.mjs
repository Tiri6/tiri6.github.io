// AGENTE CAPOREDATTORE — selezione delle candidate
// Uso: npm run prune              (default: 2 per giocatore + 15 generiche)
//      npm run prune -- --keep=3 --general=20
//
// Dopo una raccolta abbondante (es. --days=30) la coda può esplodere.
// Questo agente tiene solo le candidate MIGLIORI (per punteggio di rilevanza):
//  - al massimo N per ogni giocatore della watchlist
//  - al massimo M tra quelle senza giocatore abbinato (news generiche)
// Le scartate finiscono in pipeline/rejected/ (recuperabili, non cancellate).

import { readFile, readdir, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = path.join(ROOT, 'pipeline', 'candidates');
const REJECTED = path.join(ROOT, 'pipeline', 'rejected');

const keepArg = process.argv.find((a) => a.startsWith('--keep='));
const genArg = process.argv.find((a) => a.startsWith('--general='));
const KEEP = Math.max(1, Number(keepArg?.split('=')[1]) || 2);
const GENERAL = Math.max(0, Number(genArg?.split('=')[1]) || 15);

let files = [];
try { files = (await readdir(CANDIDATES)).filter((f) => f.endsWith('.json')); } catch {}
if (!files.length) { console.log('Coda vuota.'); process.exit(0); }

const items = [];
for (const f of files) {
  try { items.push({ file: f, ...JSON.parse(await readFile(path.join(CANDIDATES, f), 'utf8')) }); } catch {}
}

// Ordina per punteggio; le bozze già scritte hanno priorità (non si buttano soldi)
items.sort((a, b) => (b.draft ? 1 : 0) - (a.draft ? 1 : 0) || b.score - a.score);

const perPlayer = {};
let generalKept = 0;
const keep = new Set();

for (const it of items) {
  const names = it.players?.length ? it.players : null;
  if (names) {
    // La candidata resta se ALMENO un suo giocatore ha ancora posto
    const hasRoom = names.some((n) => (perPlayer[n] ?? 0) < KEEP);
    if (hasRoom) {
      names.forEach((n) => (perPlayer[n] = (perPlayer[n] ?? 0) + 1));
      keep.add(it.file);
    }
  } else if (generalKept < GENERAL) {
    generalKept++;
    keep.add(it.file);
  }
}

await mkdir(REJECTED, { recursive: true });
let moved = 0;
for (const it of items) {
  if (!keep.has(it.file)) {
    await rename(path.join(CANDIDATES, it.file), path.join(REJECTED, it.file));
    moved++;
  }
}

console.log(`🗞  Caporedattore — coda iniziale: ${items.length} candidate`);
console.log(`   ✅ Tenute: ${keep.size} (max ${KEEP} per giocatore + ${GENERAL} generiche, priorità al punteggio)`);
console.log(`   🗑  Spostate in rejected/: ${moved} (recuperabili)`);
console.log('\n   Ora: npm run write  →  npm run review');
