# ⏰ Scheduler Temporale · Italian Next Gen

## Panoramica

Il sito pubblica articoli automaticamente ogni **20 minuti dalle 9:00 alle 21:00**, 3 articoli all'ora.

**Slot giornalieri:**
- **Slot 0 (9:00)**: Taccuino (sticky, visibile tutto il giorno) 📋
- **Slot 1-38 (9:20, 9:40, 10:00...)**: Articoli normali 📰

**Totale: 37 post al giorno**

---

## Flusso Operativo

### 1️⃣ Mattina (automated)
```bash
npm run collect  # Raccoglie notizie dal radar
npm run write --max=38  # Scrive bozze articoli
npm run digest   # Crea il taccuino dalle notizie senza bozza
```

→ A questo punto hai bozze negli articoli frontali, pronte per approvazione.

### 2️⃣ Tu approvi gli articoli
Nel dashboard review (`npm run review`):
- Leggi il testo
- Correggi se serve (titoli, excerpt, corpo)
- Clicca "Pubblica" ✅

### 3️⃣ Schedule (automated)
```bash
npm run schedule [--date=YYYY-MM-DD]
```

Questo comando:
- Legge tutti gli articoli **approvati ma non schedulati** (senza `publishedAt`)
- Li ordina per data (più recenti prima)
- Assegna orari di pubblicazione agli slot disponibili
- Aggiunge il campo `publishedAt` al frontmatter

**Esempio di output:**
```
📅 Scheduler: Wednesday, July 16, 2026
🕐 Orari: 9:00 - 21:00 (intervallo 20 min)
📍 Slot disponibili: 37 (1 taccuino + 36 articoli)
📄 Articoli non schedulati: 15

✅ Schedulati 15 articoli:
  1. camarda-rilancio.md → 09:20
  2. pio-esposito-inter.md → 09:40
  3. leoni-liverpool.md → 10:00
  ...
```

### 4️⃣ Automatico: Rebuild ogni 20 minuti
GitHub Actions trigghera rebuild ogni 20 minuti (9:00-21:00 Italia).

Quando un articolo raggiunge il suo `publishedAt`:
- Il filtro Astro lo "sblocca" 🔓
- Appare sul sito
- Visibilità **istantanea** (massimo 20 minuti di ritardo)

---

## Taccuino come Sticky Post

Il taccuino viene creato ogni mattina dalla pipeline `digest`:
```bash
npm run digest
```

Il file generato ha:
```yaml
---
category: taccuino
featured: true         # ← Rimane sticky tutto il giorno
publishedAt: 2026-07-16T09:00:00Z
---
```

**Dove appare:**
- Homepage: sezione "✦ Il taccuino del giorno" (primo nella lista)
- Rimane visibile fino alle 21:00 quando scompare lo sticky
- Il giorno dopo, il nuovo taccuino prende il posto

---

## Configurazione Agenti

Gli agenti sono pre-configurati per generare il numero giusto:

| Agente | Max/giorno | Descrizione |
|--------|----------|-------------|
| `write` | 38 | Scrive bozze per i 38 slot normali |
| `digest` | 1 | 1 taccuino al giorno (fino a 12 pillole) |

**Comandi utili:**
```bash
# Scrivi fino a 38 bozze (default)
npm run write

# Scrivi solo 20 bozze (se vuoi meno)
npm run write --max=20

# Crea il taccuino
npm run digest

# Schedula gli articoli approvati
npm run schedule

# Pubblica gli articoli schedulati (opzionale, se non usi il flusso manuale)
npm run publish --max=39
```

---

## Flusso Giorno per Giorno

### Opzione A: Automatico (consigliato)
```bash
# Una sola volta, nelle tue Actions di GitHub:
# 1. collect.yml mattina tira collect+write+digest
# 2. Tu approvi dal dashboard
# 3. Tu lanci manualmente: npm run schedule
# 4. GitHub Actions rebuild ogni 20 min → articoli si accendono automaticamente
```

### Opzione B: Manuale (se ami il controllo)
```bash
# Mattina
npm run collect
npm run write
npm run digest
# Approvi dal dashboard
npm run schedule  # Assegna gli orari

# Giorno successivo, stesso processo
```

---

## Domande Frequenti

**D: Cosa succede se approvo solo 10 articoli invece di 38?**
A: Perfetto! 10 articoli prendono i primi 10 slot (9:20, 9:40, 10:00...), i 28 slot rimasti restano vuoti. Niente di male.

**D: Posso schedulare articoli per domani?**
A: Sì! Usa `npm run schedule --date=2026-07-17` per assegnare orari al giorno 17.

**D: Il taccuino è obbligatorio?**
A: No, se non lanci `digest`, la sezione "Il taccuino del giorno" non appare in homepage. Puoi saltarlo.

**D: Quando exactamente compare un articolo?**
A: Massimo 20 minuti dopo il suo `publishedAt`. Se scheduled per 10:00, apparirà entro le 10:20.

**D: Posso modificare un articolo dopo lo schedule?**
A: Sì! Modifica il file, il sito ricaricherà al prossimo rebuild (max 20 min).

**D: Cosa succede alle 21:00?**
A: GitHub Actions smette di rebuildare. Se un articolo era schedulato per 21:40, non apparirà finché non manual rebuild o il giorno dopo.

---

## Personalizzazione

### Cambia gli orari di pubblicazione
Edita `pipeline/scheduler.mjs`:
```javascript
const START_HOUR = 9;      // Cambio → 8
const END_HOUR = 21;       // Cambio → 22
const INTERVAL_MIN = 20;   // Cambio → 15 (4 articoli/ora)
```

Poi `npm run schedule` ricalcola gli slot.

### Cambia il fuso orario
```bash
npm run schedule --timezone=Europe/London
```

---

## Troubleshooting

**"Articoli non appaiono al sito"**
→ Controlla: hanno `publishedAt` nel frontmatter? È minore di ora attuale UTC? Hanno `featured: false` o omesso? Se sì a tutto, il sito non mostra fino al prossimo rebuild (max 20 min).

**"Taccuino non appare in evidenza"**
→ Controlla: ha `featured: true` nel frontmatter? Ha `publishedAt` <= ora attuale? Se sì, dovrebbe apparire.

**"Scheduler dice 'Niente da schedulare'"**
→ Tutti i tuoi articoli hanno già `publishedAt`. Se vuoi rischedularli, rimuovi la riga `publishedAt: ...` e relancia `npm run schedule`.

**"Rebuild ogni 20 minuti non funziona"**
→ Controlla che `.github/workflows/rebuild-every-20min.yml` sia pushato su GitHub. L'orario cron usa UTC, non la tua ora locale — leggi i commenti nel file.

---

## Riferimenti

- **Configurazione**: `pipeline/schedule-config.json`
- **Script**: `pipeline/scheduler.mjs`
- **Filtri Astro**: `src/lib/articles.ts`
- **Schema**: `src/content.config.ts`
- **GitHub Actions**: `.github/workflows/rebuild-every-20min.yml`
