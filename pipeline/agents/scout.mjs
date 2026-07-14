// AGENTE SCOUT
// Cerca notizie sul web per una singola query usando Google News RSS
// (nessuna API key richiesta). Ogni query è di fatto un "subagente" di ricerca.

const RSS_BASE = 'https://news.google.com/rss/search';

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extract(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

/**
 * @param {string} query - es. "Camarda Milan"
 * @param {{lang?: string, maxAgeHours?: number}} opts
 * @returns {Promise<Array<{title, link, source, pubDate, query}>>}
 */
export async function scout(query, opts = {}) {
  const { lang = 'it', maxAgeHours = 48, days = Math.ceil(maxAgeHours / 24) } = opts;
  const params = new URLSearchParams({
    q: `${query} when:${days}d`,
    hl: lang === 'it' ? 'it' : 'en-GB',
    gl: lang === 'it' ? 'IT' : 'GB',
    ceid: lang === 'it' ? 'IT:it' : 'GB:en',
  });
  const url = `${RSS_BASE}?${params}`;

  let xml;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'ItalianNextGen/1.0 (news pipeline)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.error(`  [scout] "${query}" fallita: ${err.message}`);
    return [];
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;

  return items
    .map((item) => ({
      title: extract('title', item),
      link: extract('link', item),
      source: extract('source', item),
      pubDate: extract('pubDate', item),
      query,
    }))
    .filter((it) => it.title && it.link)
    .filter((it) => {
      const t = Date.parse(it.pubDate);
      return Number.isNaN(t) || t >= cutoff;
    });
}
