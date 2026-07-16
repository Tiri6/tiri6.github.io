#!/usr/bin/env node

/**
 * scheduler.mjs - Assegna orari di pubblicazione agli articoli approvati
 *
 * SCHEMA TEMPORALE:
 * - Ore di pubblicazione: 9:00 - 21:00 (13 ore)
 * - Intervallo: 20 minuti tra articoli
 * - Articoli per ora: 3
 * - Slot totali: 39 (1 taccuino + 38 articoli)
 *
 * USO:
 *   npm run schedule [--date=YYYY-MM-DD] [--timezone=Europe/Rome]
 *
 *   Se --date non è specificato, usa la data odierna
 *   Se la data è domani, il taccuino parte alle 9:00 di domani
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const newsDir = path.join(__dir, '../src/content/news');
const candidatesDir = path.join(__dir, 'candidates');

// Configurazione
const START_HOUR = 9;      // 9:00
const END_HOUR = 21;       // 21:00
const INTERVAL_MIN = 20;   // 20 minuti tra articoli
const TIMEZONE = 'Europe/Rome';

// Parsing argomenti
const args = process.argv.slice(2);
let targetDate = new Date();
let timezoneArg = TIMEZONE;

for (const arg of args) {
  if (arg.startsWith('--date=')) {
    targetDate = new Date(arg.split('=')[1] + 'T00:00:00Z');
  }
  if (arg.startsWith('--timezone=')) {
    timezoneArg = arg.split('=')[1];
  }
}

// Genera gli slot di tempo per il giorno
function generateTimeSlots(date) {
  const slots = [];

  // Slot 0: Taccuino alle 9:00
  const taccinoTime = new Date(date);
  taccinoTime.setHours(START_HOUR, 0, 0, 0);
  slots.push({ time: taccinoTime, type: 'digest', order: 0 });

  // Slot 1+: Articoli ogni 20 minuti
  let currentTime = new Date(taccinoTime);
  currentTime.setMinutes(currentTime.getMinutes() + INTERVAL_MIN);
  let order = 1;

  while (currentTime.getHours() < END_HOUR ||
         (currentTime.getHours() === END_HOUR && currentTime.getMinutes() === 0)) {
    slots.push({ time: new Date(currentTime), type: 'article', order });
    currentTime.setMinutes(currentTime.getMinutes() + INTERVAL_MIN);
    order++;
  }

  return slots;
}

// Legge i file markdown per trovare quelli senza publishedAt
function getUnscheduledArticles() {
  const articles = [];

  const files = fs.readdirSync(newsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(newsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Estrai il frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const frontmatter = match[1];

    // Controlla se ha già publishedAt
    if (frontmatter.includes('publishedAt:')) {
      continue; // Già schedulato
    }

    articles.push({
      file,
      path: filePath,
      content,
      frontmatter,
    });
  }

  return articles;
}

// Ordina gli articoli per data (più recenti prima)
function prioritizeArticles(articles) {
  return articles.sort((a, b) => {
    const dateA = extractDate(a.frontmatter);
    const dateB = extractDate(b.frontmatter);
    return dateB - dateA; // Discendente: più recenti prima
  });
}

function extractDate(frontmatter) {
  const match = frontmatter.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return match ? new Date(match[1]) : new Date(0);
}

// Assegna publishedAt agli articoli
function scheduleArticles(articles, slots) {
  const scheduled = [];

  // Filtra i slot per articoli (esclude il taccuino)
  const articleSlots = slots.filter(s => s.type === 'article');

  for (let i = 0; i < articles.length && i < articleSlots.length; i++) {
    const article = articles[i];
    const slot = articleSlots[i];
    const publishedAt = slot.time;

    // Aggiungi publishedAt al frontmatter
    const frontmatterWithPublish = article.frontmatter +
      `\npublishedAt: ${publishedAt.toISOString().split('T')[0]}T${String(publishedAt.getHours()).padStart(2, '0')}:${String(publishedAt.getMinutes()).padStart(2, '0')}:00Z`;

    const newContent = article.content.replace(
      /^---\n[\s\S]*?\n---/,
      `---\n${frontmatterWithPublish}\n---`
    );

    fs.writeFileSync(article.path, newContent);

    scheduled.push({
      file: article.file,
      publishedAt: publishedAt.toISOString(),
    });
  }

  return scheduled;
}

// Main
async function main() {
  console.log(`📅 Scheduler: ${targetDate.toDateString()}`);
  console.log(`🕐 Orari: ${START_HOUR}:00 - ${END_HOUR}:00 (intervallo ${INTERVAL_MIN} min)`);

  const slots = generateTimeSlots(targetDate);
  console.log(`📍 Slot disponibili: ${slots.length} (1 taccuino + ${slots.length - 1} articoli)`);

  const unscheduled = getUnscheduledArticles();
  console.log(`📄 Articoli non schedulati: ${unscheduled.length}`);

  if (unscheduled.length === 0) {
    console.log('✅ Niente da schedulare.');
    return;
  }

  const prioritized = prioritizeArticles(unscheduled);
  const scheduled = scheduleArticles(prioritized, slots);

  console.log(`\n✅ Schedulati ${scheduled.length} articoli:`);
  scheduled.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.file} → ${new Date(s.publishedAt).toLocaleTimeString('it-IT')}`);
  });
}

main().catch(err => {
  console.error('❌ Errore:', err.message);
  process.exit(1);
});
