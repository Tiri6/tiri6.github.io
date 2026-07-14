// IMPORT DA FOOTBALL MANAGER
// Uso: node pipeline/import-fm.mjs <file-esportato>
//
// In FM: Ricerca giocatori → filtra (nazionalità Italia, età max 21) → personalizza
// la vista con colonne Nome, Club, Ruolo, Età → menu FM/stampa → "Pagina web".
// Poi trascina il file esportato nella cartella del progetto e lancia questo script:
// i giocatori NUOVI vengono aggiunti a data/players.json (status "da-verificare"
// nel campo _imported, così li riconosci e li sistemi a mano).
//
// Nota: i dati di FM (in particolare i valori di potenziale) sono proprietà di
// Sports Interactive — usali come scouting interno, non pubblicarli sul sito.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_FILE = path.join(ROOT, 'data', 'players.json');

const ROLE_MAP = [
  [/gk|por/i, 'Portiere'],
  [/d.*[cl r]|dc|difensore/i, 'Difensore centrale'],
  [/wb|terzino|full.?back/i, 'Terzino'],
  [/dm|mc|cm|centrocamp|midfield/i, 'Centrocampista'],
  [/am|trequart|attacking mid/i, 'Trequartista'],
  [/[ma][lr]|wing|ala/i, 'Ala'],
  [/st|att|forward|punta/i, 'Attaccante'],
];

function guessRole(raw) {
  for (const [re, role] of ROLE_MAP) if (re.test(raw)) return role;
  return raw || 'Centrocampista';
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

function parseHtml(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]))
  );
  return rows.filter((r) => r.length >= 2);
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, '').trim()))
    .filter((r) => r.length >= 2);
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Uso: node pipeline/import-fm.mjs <file esportato da FM (.html o .csv)>');
    process.exit(1);
  }

  const raw = await readFile(input, 'utf8');
  const rows = raw.trimStart().startsWith('<') ? parseHtml(raw) : parseCsv(raw);
  if (rows.length < 2) {
    console.error('Nessuna tabella riconosciuta nel file. Esporta da FM come "pagina web" o CSV.');
    process.exit(1);
  }

  // Individua le colonne dall'intestazione
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iName = col(['name', 'nome']);
  const iClub = col(['club', 'squadra']);
  const iRole = col(['position', 'ruolo', 'pos']);
  const iAge = col(['age', 'età', 'eta']);
  const iBorn = col(['born', 'nascita', 'anno']);
  if (iName < 0) {
    console.error(`Colonna "Nome" non trovata. Intestazioni lette: ${rows[0].join(' | ')}`);
    process.exit(1);
  }

  const db = JSON.parse(await readFile(PLAYERS_FILE, 'utf8'));
  const existing = new Set(db.players.map((p) => p.name.toLowerCase()));
  const year = new Date().getFullYear();
  let added = 0;

  for (const row of rows.slice(1)) {
    const name = row[iName];
    if (!name || existing.has(name.toLowerCase())) continue;
    const born = iBorn >= 0 && /^\d{4}$/.test(row[iBorn] ?? '')
      ? Number(row[iBorn])
      : iAge >= 0 && /^\d{1,2}$/.test(row[iAge] ?? '')
        ? year - Number(row[iAge])
        : year - 18;

    db.players.push({
      name,
      club: (iClub >= 0 && row[iClub]) || 'Da verificare',
      role: guessRole(iRole >= 0 ? row[iRole] ?? '' : ''),
      born,
      status: 'giovanili',
      queries: [name],
      _imported: 'fm-da-verificare',
    });
    existing.add(name.toLowerCase());
    added++;
  }

  await writeFile(PLAYERS_FILE, JSON.stringify(db, null, 2));
  console.log(`✅ Importati ${added} nuovi giocatori (totale: ${db.players.length}).`);
  console.log('   Cerca "_imported" in data/players.json per verificare club, ruolo e status.');
}

main().catch((err) => { console.error('Errore:', err.message); process.exit(1); });
