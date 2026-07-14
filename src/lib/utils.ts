// Utility condivise tra pagine IT e EN.

export const CATEGORY_LABELS: Record<string, { it: string; en: string; color: string }> = {
  news: { it: 'News', en: 'News', color: '#2dd48f' },
  performance: { it: 'Prestazioni', en: 'Performance', color: '#7cc0ea' },
  mercato: { it: 'Mercato', en: 'Transfers', color: '#f0c94a' },
  editoriale: { it: 'Editoriale', en: 'Editorial', color: '#ff9daa' },
  taccuino: { it: 'Taccuino', en: 'Notebook', color: '#4aa3e0' },
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const STATUS_LABELS: Record<string, { it: string; en: string }> = {
  'serie-a': { it: 'Serie A', en: 'Serie A' },
  'serie-b': { it: 'Serie B', en: 'Serie B' },
  'serie-c': { it: 'Serie C', en: 'Serie C' },
  'estero': { it: 'Estero', en: 'Abroad' },
  'primavera': { it: 'Primavera', en: 'Primavera' },
  'giovanili': { it: 'Giovanili', en: 'Academy' },
};

/** Link al profilo Transfermarkt: diretto se noto, altrimenti ricerca TM sul nome. */
export function tmLink(player: { name: string; tmUrl?: string }): string {
  return (
    player.tmUrl ??
    `https://www.transfermarkt.it/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(player.name)}`
  );
}

/** Genera i punti per la mini-sparkline del valore di mercato (SVG 240x70). */
export function sparkline(history: { date: string; value: number }[]) {
  const W = 240, H = 56, PAD = 6;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = history.map((h, i) => ({
    x: PAD + (i * (W - 2 * PAD)) / Math.max(1, history.length - 1),
    y: H - PAD - ((h.value - min) / range) * (H - 2 * PAD),
    ...h,
  }));
  return { W, H, pts, line: pts.map((p) => `${p.x},${p.y}`).join(' ') };
}

export const CAP_LABELS: Record<string, { it: string; en: string }> = {
  u15: { it: 'Under 15', en: 'Under 15' },
  u16: { it: 'Under 16', en: 'Under 16' },
  u17: { it: 'Under 17', en: 'Under 17' },
  u18: { it: 'Under 18', en: 'Under 18' },
  u19: { it: 'Under 19', en: 'Under 19' },
  u20: { it: 'Under 20', en: 'Under 20' },
  u21: { it: 'Under 21', en: 'Under 21' },
  a: { it: 'Nazionale A', en: 'Senior team' },
};

export function formatDate(date: Date, lang: 'it' | 'en'): string {
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Il body degli articoli contiene la versione italiana, un marker <!--EN-->,
// poi la versione inglese. Questa funzione separa le due parti.
export function splitBody(body: string): { it: string; en: string } {
  const [it, en] = body.split('<!--EN-->');
  return { it: (it ?? '').trim(), en: (en ?? it ?? '').trim() };
}

// Renderer markdown minimale (paragrafi, grassetto, corsivo, link).
// Gli articoli della pipeline usano solo questi elementi.
export function renderParagraphs(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      let html = esc(p);
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      );
      return `<p>${html}</p>`;
    })
    .join('\n');
}
