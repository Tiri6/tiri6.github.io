// AGENTE REDATTORE
// Prende una candidata (titolo + link alla fonte), legge l'articolo originale
// e scrive una BOZZA in italiano e inglese CON PAROLE PROPRIE, riportando solo
// i fatti presenti nella fonte. La bozza precompila la dashboard di review:
// l'ultima parola resta sempre al proprietario.
//
// Richiede una chiave API di Anthropic (https://console.anthropic.com):
// mettila nel file .env come ANTHROPIC_API_KEY=sk-ant-...

const MODEL = 'claude-haiku-4-5-20251001';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return { finalUrl: res.url, html: await res.text() };
}

async function fetchSource(url) {
  try {
    let page = await fetchUrl(url);
    if (!page) return null;

    // I link di Google News sono pagine di redirect: pesca l'URL dell'editore e seguilo
    if (/news\.google\./.test(page.finalUrl)) {
      const m = page.html.match(/https?:\/\/(?!news\.google|www\.google|accounts\.google|gstatic|googleusercontent)[a-z0-9.-]+\.[a-z]{2,}\/[^"'\\\s<>]{10,}/i);
      if (m) {
        page = await fetchUrl(m[0]);
        if (!page) return null;
      } else {
        return null;
      }
    }

    const text = stripHtml(page.html);
    return text.length > 300 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} candidate - la candidata dalla pipeline
 * @param {string} apiKey - chiave API Anthropic
 * @returns {Promise<object|null>} draft {titleEn, excerpt, excerptEn, bodyIt, bodyEn}
 */
export async function writeDraft(candidate, apiKey) {
  const sourceText = await fetchSource(candidate.link);

  const context = sourceText
    ? `TESTO DELLA FONTE (usa SOLO i fatti presenti qui):\n${sourceText}`
    : `Non è stato possibile leggere la fonte. Scrivi una bozza PRUDENTE basata solo sul titolo, senza inventare dettagli (niente minuti, punteggi o nomi non presenti nel titolo), e chiudi il testo italiano con: "(Bozza dal solo titolo: verificare i dettagli sulla fonte.)"`;

  const prompt = `Sei il redattore di "Italian Next Gen", sito di news sui giovani calciatori italiani (obiettivo: Mondiali 2030). Tono: appassionato ma sobrio, da quotidiano sportivo di qualità.

NOTIZIA: ${candidate.title}
FONTE: ${candidate.source}
GIOCATORI SEGUITI CITATI: ${(candidate.players ?? []).join(', ') || 'nessuno in watchlist'}

${context}

REGOLE FERREE:
- Scrivi un TITOLO ITALIANO nuovo, pulito e giornalistico (max 90 caratteri): NON copiare il titolo della fonte, NON includere codici, maiuscole urlate, emoji, nomi di testate o riferimenti a video/dirette. Solo il fatto sportivo.
- Riscrivi TUTTO con parole tue: mai copiare frasi dalla fonte.
- Solo fatti presenti nella fonte o nel titolo. VIETATO inventare dettagli.
- 2-3 paragrafi brevi per lingua, separati da riga vuota.
- Se pertinente, chiudi collegando alla prospettiva 2030.

Rispondi SOLO con JSON valido:
{"title":"titolo italiano pulito","titleEn":"titolo inglese pulito","excerpt":"sommario italiano di 1-2 frasi","excerptEn":"sommario inglese","bodyIt":"articolo italiano","bodyEn":"articolo inglese"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const draft = JSON.parse(jsonMatch[0]);
    draft._fromSource = Boolean(sourceText);
    return draft;
  } catch {
    return null;
  }
}
