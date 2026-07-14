// DASHBOARD DI REVIEW — approvazione del proprietario
// Uso: npm run review  →  apri http://localhost:4321/review (porta 8787)
//
// Mostra le candidate raccolte dalla pipeline. Per ognuna puoi modificare
// titolo, sommario e testo (IT/EN), poi Approvare (diventa un articolo
// pubblicato in src/content/news/) o Rifiutare.

import http from 'node:http';
import { readFile, writeFile, readdir, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = path.join(ROOT, 'pipeline', 'candidates');
const REJECTED = path.join(ROOT, 'pipeline', 'rejected');
const APPROVED = path.join(ROOT, 'pipeline', 'approved');
const NEWS = path.join(ROOT, 'src', 'content', 'news');
const PORT = 8787;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function yamlEscape(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function listCandidates() {
  await mkdir(CANDIDATES, { recursive: true });
  const files = (await readdir(CANDIDATES)).filter((f) => f.endsWith('.json'));
  const items = [];
  for (const f of files) {
    try {
      items.push({ file: f, ...JSON.parse(await readFile(path.join(CANDIDATES, f), 'utf8')) });
    } catch { /* file corrotto: ignora */ }
  }
  return items.sort((a, b) => b.score - a.score);
}

async function approve(body) {
  const { file, title, titleEn, excerpt, excerptEn, bodyIt, bodyEn, category, players, source, link, image, competitions } = body;
  const compList = (Array.isArray(competitions) ? competitions : String(competitions ?? '').split(','))
    .map((c) => String(c).trim())
    .filter(Boolean);
  const slug = slugify(title);
  const date = new Date().toISOString().slice(0, 10);
  const playersYaml = (players ?? []).map((p) => yamlEscape(p)).join(', ');

  const md = `---
title: ${yamlEscape(title)}
titleEn: ${yamlEscape(titleEn || title)}
excerpt: ${yamlEscape(excerpt)}
excerptEn: ${yamlEscape(excerptEn || excerpt)}
date: ${date}
category: ${category}
players: [${playersYaml}]
competitions: [${compList.map((c) => yamlEscape(c)).join(', ')}]
source: ${yamlEscape(source || '')}
sourceUrl: ${yamlEscape(link || '')}${image ? `\nimage: ${yamlEscape(image)}` : ''}
---

${(bodyIt || excerpt).trim()}

<!--EN-->

${(bodyEn || bodyIt || excerptEn || excerpt).trim()}
`;

  await mkdir(NEWS, { recursive: true });
  await mkdir(APPROVED, { recursive: true });
  await writeFile(path.join(NEWS, `${slug}.md`), md);
  await rename(path.join(CANDIDATES, file), path.join(APPROVED, file));
  return slug;
}

async function reject(body) {
  await mkdir(REJECTED, { recursive: true });
  await rename(path.join(CANDIDATES, body.file), path.join(REJECTED, body.file));
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(candidates) {
  const cards = candidates
    .map(
      (c) => `
    <div class="card" id="card-${c.id}">
      <div class="row">
        <span class="badge ${c.category}">${c.category}</span>
        <span class="score">rilevanza ${c.score}</span>
        <span class="src">${c.source} · ${c.pubDate ? new Date(c.pubDate).toLocaleString('it-IT') : ''}</span>
      </div>
      <a class="orig" href="${c.link}" target="_blank" rel="noopener">↗ apri la fonte originale</a>
      <label>Titolo (IT)</label>
      <input name="title" value="${c.title.replace(/"/g, '&quot;')}" />
      ${c.draft ? `<div class="draft-note">🖋 Bozza scritta dall'agente redattore${c.draft._fromSource ? ' (dalla fonte)' : ' <b>dal solo titolo: verifica i fatti!</b>'} — leggi e correggi prima di approvare.</div>` : ''}
      <label>Titolo (EN)</label>
      <input name="titleEn" value="${esc(c.draft?.titleEn)}" placeholder="Traduzione inglese del titolo" />
      <label>Sommario (IT)</label>
      <textarea name="excerpt" rows="2" placeholder="Due righe di sommario">${esc(c.draft?.excerpt)}</textarea>
      <label>Sommario (EN)</label>
      <textarea name="excerptEn" rows="2" placeholder="English summary">${esc(c.draft?.excerptEn)}</textarea>
      <label>Testo articolo (IT)</label>
      <textarea name="bodyIt" rows="7" placeholder="Scrivi o incolla il testo dell'articolo in italiano">${esc(c.draft?.bodyIt)}</textarea>
      <label>Testo articolo (EN)</label>
      <textarea name="bodyEn" rows="7" placeholder="English article text">${esc(c.draft?.bodyEn)}</textarea>
      <label>Foto (URL o /percorso in public/ — vuoto = copertina generata)</label>
      <input name="image" placeholder="https://... oppure /foto/camarda.jpg" />
      <label>Competizioni (id separati da virgola: euro-u19-2026, euro-u21-2027, euro-u17, mondiale-u17-2026, mondiale-u20-2027, under-15-16, road-to-2030)</label>
      <input name="competitions" value="${(c.competitions ?? []).join(', ')}" placeholder="euro-u19-2026" />
      <div class="row">
        <label style="margin:0">Categoria</label>
        <select name="category">
          ${['news', 'performance', 'mercato', 'editoriale', 'taccuino']
            .map((cat) => `<option ${cat === c.category ? 'selected' : ''}>${cat}</option>`)
            .join('')}
        </select>
        <span class="players">⚽ ${(c.players ?? []).join(', ') || '—'}</span>
      </div>
      <div class="actions">
        <button class="ok" onclick="act('approve', '${c.id}')">✓ Approva e pubblica</button>
        <button class="no" onclick="act('reject', '${c.id}')">✗ Rifiuta</button>
      </div>
    </div>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review — Italian Next Gen</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0d1b2e; color:#e8eef6; margin:0; padding:2rem 1rem; }
  .wrap { max-width: 780px; margin: 0 auto; }
  h1 { font-size:1.4rem; } h1 em { color:#7cc0ea; font-style:normal; }
  .empty { background:#13253f; border-radius:10px; padding:2rem; text-align:center; color:#9fb3cc; }
  .card { background:#13253f; border:1px solid #24405f; border-radius:10px; padding:1.2rem 1.4rem; margin-bottom:1.2rem; }
  .row { display:flex; gap:.8rem; align-items:center; flex-wrap:wrap; margin-bottom:.5rem; }
  .badge { font-size:.7rem; font-weight:700; text-transform:uppercase; padding:.15rem .5rem; border-radius:3px; background:#1a7f5a; }
  .badge.mercato { background:#b3541e; } .badge.performance { background:#0b5fa5; }
  .score { color:#d4a72c; font-size:.8rem; font-weight:600; }
  .src { color:#9fb3cc; font-size:.8rem; }
  .orig { color:#7cc0ea; font-size:.85rem; display:inline-block; margin-bottom:.6rem; }
  .draft-note { background:rgba(240,201,74,.1); border:1px solid rgba(240,201,74,.35); border-radius:6px; padding:.5rem .8rem; font-size:.82rem; color:#f0c94a; margin-bottom:.4rem; }
  label { display:block; font-size:.75rem; color:#9fb3cc; margin:.6rem 0 .2rem; text-transform:uppercase; letter-spacing:.05em; }
  input, textarea, select { width:100%; background:#0d1b2e; color:#e8eef6; border:1px solid #24405f; border-radius:6px; padding:.5rem .6rem; font-size:.92rem; font-family:inherit; box-sizing:border-box; }
  select { width:auto; }
  .players { color:#9fb3cc; font-size:.85rem; margin-left:auto; }
  .actions { display:flex; gap:.8rem; margin-top:1rem; }
  button { border:0; border-radius:6px; padding:.55rem 1.2rem; font-weight:700; cursor:pointer; font-size:.9rem; }
  .ok { background:#1a7f5a; color:#fff; } .no { background:#7f1a2e; color:#fff; }
  button:disabled { opacity:.5; cursor:wait; }
</style></head>
<body><div class="wrap">
<h1>🇮🇹 Italian <em>Next Gen</em> — Review delle candidate (${candidates.length})</h1>
${candidates.length ? cards : '<div class="empty">Nessuna candidata in coda.<br>Lancia <code>npm run collect</code> per raccogliere le notizie di oggi.</div>'}
<script>
async function act(action, id) {
  const card = document.getElementById('card-' + id);
  const data = { file: id + '.json' };
  for (const el of card.querySelectorAll('input,textarea,select')) data[el.name] = el.value;
  card.querySelectorAll('button').forEach((b) => (b.disabled = true));
  const res = await fetch('/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (res.ok) { card.style.opacity = .35; card.querySelector('.actions').innerHTML = action === 'approve' ? '✅ Pubblicato' : '🗑 Rifiutato'; }
  else { alert('Errore: ' + (await res.text())); card.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
}
</script>
</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(await listCandidates()));
      return;
    }
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      // Anti path-traversal: accetta solo nomi file semplici
      if (!/^[\w-]+\.json$/.test(body.file)) throw new Error('nome file non valido');

      if (req.url === '/approve') {
        // Blocco anti-articoli-vuoti: senza testo non si pubblica
        if (!body.bodyIt || body.bodyIt.trim().length < 40) {
          res.writeHead(400);
          res.end('Il testo italiano è vuoto o troppo corto: scrivi/genera la bozza prima di pubblicare (npm run write).');
          return;
        }
        const candidate = JSON.parse(await readFile(path.join(CANDIDATES, body.file), 'utf8'));
        const slug = await approve({ ...candidate, ...body, link: candidate.link, source: candidate.source, players: candidate.players });
        res.writeHead(200); res.end(slug);
        console.log(`✅ Approvato: ${slug}`);
        return;
      }
      if (req.url === '/reject') {
        await reject(body);
        res.writeHead(200); res.end('ok');
        console.log(`🗑 Rifiutato: ${body.file}`);
        return;
      }
    }
    res.writeHead(404); res.end('not found');
  } catch (err) {
    res.writeHead(500); res.end(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`🇮🇹 Dashboard di review attiva → http://localhost:${PORT}`);
  console.log('   Approva le candidate, poi `npm run build` per pubblicare il sito.');
});
