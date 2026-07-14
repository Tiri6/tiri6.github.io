// AGENTE RISULTATI
// Uso: npm run results
//
// Per ogni competizione in data/competitions.json cerca su Google News RSS i
// risultati delle partite già giocate ma senza punteggio (di TUTTE le squadre,
// non solo dell'Italia) e aggiorna il file. Riconosce nei titoli i pattern tipo
// "Italia-Croazia 2-1" o "Serbia batte Ucraina 3-0".
//
// Le partite aggiornate vengono loggate: controlla sempre che il punteggio sia
// giusto — un titolo ambiguo può ingannare l'agente.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scout } from './agents/scout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMP_FILE = path.join(ROOT, 'data', 'competitions.json');

// Alias per abbinare i nomi delle squadre nei titoli (IT/EN)
const ALIASES = {
  italia: ['italia', 'italy', 'azzurrini', 'azzurri'],
  ucraina: ['ucraina', 'ukraine'],
  croazia: ['croazia', 'croatia'],
  serbia: ['serbia'],
  galles: ['galles', 'wales'],
  spagna: ['spagna', 'spain'],
  belgio: ['belgio', 'belgium'],
  polonia: ['polonia', 'poland'],
  svezia: ['svezia', 'sweden'],
  montenegro: ['montenegro'],
  armenia: ['armenia'],
  francia: ['francia', 'france'],
  'macedonia del nord': ['macedonia'],
};

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function teamMatches(teamName, text) {
  const t = norm(teamName);
  const names = ALIASES[t] ?? [t];
  return names.some((n) => text.includes(n));
}

// Estrae pattern "SquadraA-SquadraB 2-1" o "... 2-1 ..." vicino ai nomi
function findScore(title, home, away) {
  const text = norm(title);
  if (!teamMatches(home, text) || !teamMatches(away, text)) return null;

  // punteggio esplicito N-N (evita date tipo 2026-06)
  const scores = [...text.matchAll(/(?<!\d)(\d{1,2})\s*[-–:]\s*(\d{1,2})(?!\d)/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([a, b]) => a <= 15 && b <= 15);
  if (!scores.length) return null;
  const [a, b] = scores[0];

  // Se il titolo è "away-home" invertito, inverti il punteggio
  const homeIdx = Math.min(...(ALIASES[norm(home)] ?? [norm(home)]).map((n) => {
    const i = text.indexOf(n); return i < 0 ? Infinity : i;
  }));
  const awayIdx = Math.min(...(ALIASES[norm(away)] ?? [norm(away)]).map((n) => {
    const i = text.indexOf(n); return i < 0 ? Infinity : i;
  }));
  return homeIdx <= awayIdx ? `${a}-${b}` : `${b}-${a}`;
}

async function main() {
  console.log('🇮🇹 Italian Next Gen — agente risultati\n');
  const db = JSON.parse(await readFile(COMP_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;

  for (const comp of db.competitions) {
    const pending = (comp.matches ?? []).filter(
      (m) => !m.result && m.date <= today && !/da definire|tbd|1ª|2ª/i.test(`${m.home} ${m.away}`)
    );
    if (!pending.length) continue;

    console.log(`▸ ${comp.short}: ${pending.length} partite senza risultato`);
    for (const match of pending) {
      const queries = [
        `${match.home} ${match.away} ${comp.team} risultato`,
        `${match.home} ${match.away} ${comp.short}`,
      ];
      let found = null;
      for (const q of queries) {
        const items = await scout(q, { maxAgeHours: 24 * 14 });
        for (const item of items) {
          found = findScore(item.title, match.home, match.away);
          if (found) {
            console.log(`  ✓ ${match.home}-${match.away} → ${found}  (fonte: ${item.source || item.link})`);
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        match.result = found;
        match._autoResult = true; // segnala che l'ha scritto l'agente: verifica!
        updated++;
      } else {
        console.log(`  ✗ ${match.home}-${match.away}: risultato non trovato`);
      }
    }
  }

  if (updated > 0) {
    await writeFile(COMP_FILE, JSON.stringify(db, null, 2));
    console.log(`\n✅ Aggiornati ${updated} risultati in data/competitions.json (cerca "_autoResult" per verificarli).`);
    console.log('   Poi: npm run build per pubblicare.');
  } else {
    console.log('\nNessun nuovo risultato trovato.');
  }
}

main().catch((err) => { console.error('Errore:', err); process.exit(1); });
