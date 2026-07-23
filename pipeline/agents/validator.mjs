// AGENTE VALIDATORE
// Riceve gli item grezzi dagli scout e:
//  1. scarta duplicati (stesso link o titolo quasi identico)
//  2. scarta ciò che è già stato visto in esecuzioni precedenti
//  3. abbina ogni notizia ai giocatori della watchlist
//  4. assegna un punteggio di rilevanza e una categoria
//  5. produce le "candidate" da sottoporre all'approvazione del proprietario

const MERCATO_KW = /mercato|trasferim|cessione|rinnovo|clausola|offerta|prestito|acquisto|transfer|loan|bid|signing|contract/i;

// Contesto calcistico: se un titolo contiene una di queste parole, il match sul
// solo cognome è affidabile. Altrimenti serve il nome completo.
const FOOTBALL_CTX = /calcio|calciatore|gol|goal|assist|partita|match|gara|serie [abc]|primavera|under|nazionale|azzurr|mercato|trasferim|prestito|club|allenatore|mister|panchina|esordio|convocat|derby|campionato|coppa|stadio|attaccante|difensore|centrocampista|portiere|terzino|trequartista|squadra|next ?gen|youth|academy|figc|uefa|fifa/i;

// Fuori tema palese: arte, cronaca, gossip, musica, ecc. Scarta a prescindere.
const OFFTOPIC_KW = /galleria|mostra|museo|pittore|artist|cantante|musica|concerto|film|cinema|attore|attrice|moda|fashion|ricetta|cucina|meteo|oroscopo|politica|elezion|processo|tribunale|matrimonio|fidanzat|gossip|reality|tv show/i;

// Mappa parole chiave → id competizione (vedi data/competitions.json)
const COMP_MAP = [
  [/under ?21|u21/i, 'euro-u21-2027'],
  [/under ?19|u19/i, 'euro-u19-2026'],
  [/under ?17|u17/i, 'euro-u17'],
  [/under ?20|u20/i, 'mondiale-u20-2027'],
  [/under ?1[56]|u1[56]|giovanissimi/i, 'under-15-16'],
  [/mondiale|mondiali|2030/i, 'road-to-2030'],
];
const PERFORMANCE_KW = /gol|goal|assist|doppietta|tripletta|pagelle|prestazion|titolare|esordio|debutto|match|partita|vittoria|segna|decisivo|man of the match|brace|hat-?trick/i;

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-zà-ù0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

function lastName(fullName) {
  const parts = fullName.split(' ');
  return parts[parts.length - 1];
}

/**
 * @param {Array} items - output degli scout
 * @param {Array} players - watchlist da data/players.json
 * @param {Set<string>} seen - link/titoli già processati
 */
export function validate(items, players, seen) {
  const out = [];
  const seenTitles = new Set();

  for (const item of items) {
    const normTitle = normalizeTitle(item.title);
    if (!normTitle) continue;
    if (seen.has(item.link) || seen.has(normTitle)) continue;
    if (seenTitles.has(normTitle)) continue;

    // Scarta subito le notizie palesemente fuori tema (arte, cronaca, gossip, musica…)
    if (OFFTOPIC_KW.test(item.title)) continue;

    // Abbina i giocatori: il NOME COMPLETO conta di più; il solo cognome vale
    // solo se il titolo ha anche un contesto calcistico (evita omonimie tipo
    // "Leonardo Casadei" alla mostra d'arte vs Cesare Casadei calciatore).
    const hasFootballCtx = FOOTBALL_CTX.test(item.title);
    const matched = players.filter((p) => {
      if (normTitle.includes(p.name.toLowerCase())) return true; // nome+cognome: sempre valido
      const ln = lastName(p.name).toLowerCase();
      return hasFootballCtx && normTitle.includes(ln); // solo cognome: serve contesto calcio
    });

    // Punteggio di rilevanza
    let score = 0;
    // Il match sul nome completo pesa di più di quello sul solo cognome
    for (const p of matched) {
      score += normTitle.includes(p.name.toLowerCase()) ? 4 : 2;
    }
    if (PERFORMANCE_KW.test(item.title)) score += 2;
    if (MERCATO_KW.test(item.title)) score += 2;
    if (/under ?\d{2}|u\d{2}|nazionale|azzurr|primavera|giovanil|next ?gen|futuro|allievi|giovanissimi|youth league|academy|serie [bc]/i.test(item.title)) score += 2;
    if (/italian|italy|italia/i.test(item.title)) score += 1;

    // Sotto soglia: scarta (rumore). Alziamo la soglia a 4: un solo aggancio
    // debole (cognome senza contesto) non basta più.
    if (score < 4) continue;

    // Classificazione
    let category = 'news';
    if (MERCATO_KW.test(item.title)) category = 'mercato';
    else if (PERFORMANCE_KW.test(item.title)) category = 'performance';

    // Suggerisci le competizioni collegate
    const competitions = COMP_MAP.filter(([re]) => re.test(item.title)).map(([, id]) => id);

    seenTitles.add(normTitle);
    out.push({
      competitions,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      collectedAt: new Date().toISOString(),
      title: item.title,
      link: item.link,
      source: item.source || new URL(item.link).hostname,
      pubDate: item.pubDate,
      query: item.query,
      players: matched.map((p) => p.name),
      category,
      score,
      status: 'pending',
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
