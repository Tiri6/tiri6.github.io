# 🇮🇹 Italian Next Gen

Sito di notizie quotidiane su tutti i giovani calciatori italiani — nel giro delle giovanili o all'estero. Missione: arrivare al **Mondiale 2030** con la generazione più seguita di sempre.

Ispirato ad [aiwat.ch](https://aiwat.ch): una pipeline di agenti raccoglie le notizie dal web, un agente validatore le filtra, e il proprietario approva quelle da pubblicare.

## Come funziona

```
watchlist (data/players.json)
        │
        ▼
┌─ AGENTI SCOUT ─────────────┐   una ricerca Google News RSS
│ scout("Camarda Milan")     │   per ogni giocatore + query
│ scout("Leoni Liverpool")   │   generali (U21, italiani
│ scout("Italia Under 21")…  │   all'estero, ecc.)
└──────────┬─────────────────┘
           ▼
┌─ AGENTE VALIDATORE ────────┐   dedup, scarto del rumore,
│ pipeline/agents/validator  │   abbinamento giocatori,
└──────────┬─────────────────┘   punteggio, categoria
           ▼
   pipeline/candidates/*.json    ← in attesa di approvazione
           ▼
┌─ DASHBOARD DI REVIEW ──────┐   npm run review
│ approvi / modifichi /      │   http://localhost:8787
│ rifiuti ogni candidata     │
└──────────┬─────────────────┘
           ▼
   src/content/news/*.md         ← articolo pubblicato (IT + EN)
           ▼
   npm run build → sito statico
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm install` | installa le dipendenze (solo Astro) |
| `npm run collect` | lancia la pipeline: scout → validatore → candidate |
| `npm run review` | apre la dashboard di approvazione su http://localhost:8787 |
| `npm run dev` | anteprima del sito su http://localhost:4321 |
| `npm run build` | genera il sito statico in `dist/` |
| `npm run results` | agente risultati: cerca i punteggi delle partite giocate e aggiorna i calendari |
| `node pipeline/import-fm.mjs <file>` | importa giocatori da un export di Football Manager (HTML o CSV) |

## Flusso quotidiano

1. `npm run collect` — raccoglie le notizie delle ultime 48 ore (primo giro: `npm run collect -- --days=30`).
2. `npm run prune` — **il caporedattore** sfoltisce la coda: tiene solo le migliori candidate (default: 2 per giocatore + 15 generiche, per punteggio). Indispensabile dopo una raccolta ampia. Le scartate vanno in `pipeline/rejected/`, recuperabili.
3. `npm run write` — **l'agente redattore** legge ogni fonte e scrive la bozza dell'articolo (IT+EN) con parole proprie. Scrive al massimo 40 bozze per esecuzione (`--max=N` per cambiare), partendo dalle notizie più rilevanti. Richiede il file `.env` con `ANTHROPIC_API_KEY=sk-ant-...` (chiave da console.anthropic.com; ~mezzo centesimo per articolo).
4. `npm run digest` — **il Taccuino del giorno**: raccoglie le notizie minori rimaste senza bozza (max 15) in UN solo articolo a pillole, ognuna con link alla fonte. Le notizie usate finiscono in `pipeline/digested/`. Flusso consigliato: write per le storie grosse, digest per il resto.
5. `npm run review` — trovi i campi già compilati: leggi, correggi e approvi. Le bozze scritte dal solo titolo (fonte non leggibile) sono segnalate: verificale con più attenzione.
6. `npm run publish` — pubblica in automatico fino a 100 bozze **di qualità** (solo quelle scritte leggendo la fonte; mai articoli vuoti). `--max=N` per cambiarne il numero, `--all` per forzare anche le bozze dal solo titolo (sconsigliato).
7. `npm run coverage` — controlla che ogni giocatore abbia articoli.
8. `git push` — il workflow di deploy pubblica il sito su GitHub Pages.

**Pagine legali**: `/privacy/` e `/cookie/` (IT+EN) descrivono i trattamenti reali del sito e si aggiornano da sole quando attivi la pubblicità. Font self-hosted (nessuna chiamata a Google Fonts). `/chi-siamo/` è un segnaposto da compilare.

**Pubblicità (AdSense)**: configurazione in `data/ads.json` — con `enabled: false` (default) il sito non carica nulla di Google. Per attivare: account su adsense.google.com dopo la pubblicazione, incolla il client ID (`ca-pub-...`) e metti `enabled: true`; appariranno due banner laterali discreti (solo su schermi larghi) preceduti dal banner di consenso cookie.

**Condivisione**: ogni articolo ha i pulsanti WhatsApp, Condividi (menu nativo del telefono: da lì Instagram Stories/post) e Copia link.

**Homepage**: in evidenza vanno l'ultimo Editoriale (categoria `editoriale` — scrivilo una volta a settimana anche direttamente come file md) e l'ultimo Taccuino; sotto, la sezione "Radar azzurro" unisce numeri e ultime prestazioni.

**Donazioni "Offrimi un caffè"**: banner dorato in cima a ogni pagina → `/sostieni/`. Per attivarle: crea il tuo link su paypal.me (consigliato: supporta importi 5/10/20€ e il messaggio del donatore) oppure buymeacoffee.com, e incollalo in `data/support.json`. Finché il campo è vuoto la pagina mostra "donazioni attive a breve".

**Nota legale**: l'agente redattore riscrive i fatti con parole proprie e il sito linka sempre la fonte originale — mai copiare testi o foto altrui.

## Struttura contenuti

Ogni articolo è un file markdown in `src/content/news/` con frontmatter bilingue (`title`/`titleEn`, `excerpt`/`excerptEn`) e corpo diviso dal marker `<!--EN-->`: prima la versione italiana, dopo quella inglese.

**Foto degli articoli**: il campo opzionale `image` nel frontmatter accetta un URL o un percorso in `public/` (es. `/foto/camarda.jpg`). Se assente, il sito genera automaticamente una copertina blu/oro con le iniziali del giocatore. Puoi impostare la foto anche dalla dashboard di review. Attenzione ai diritti: usa solo foto di cui hai licenza (es. Wikimedia Commons con attribuzione).

**Ultime prestazioni**: la sezione in homepage legge `data/performances.json` — aggiorna il file dopo ogni giornata. **Regola di affidabilità**: si pubblicano solo prestazioni verificate e ogni voce deve avere `source`/`sourceUrl`; i campi non verificati (minuti, voto) si omettono e il sito non li mostra. Il link alla fonte appare su ogni card.

La watchlist dei giocatori è in `data/players.json`: aggiungi un giocatore e la pipeline inizierà a cercarne le notizie dal giorno dopo. Le `extraQueries` coprono Serie A/B/C, Primavera, squadre Next Gen/U23, campionati Allievi e Giovanissimi, tutte le nazionali giovanili (U15–U21), la Youth League e i giovani italiani nei campionati esteri.

**Schede giocatore**: ogni giocatore della watchlist ha una pagina `/giocatori/<nome>/` generata automaticamente, con dati anagrafici, età che avrà nel 2030, ultime prestazioni e news collegate.

**Preferiti**: i visitatori possono aggiungere giocatori ai preferiti con la ★ (salvati nel browser, nessun account necessario). I preferiti appaiono in cima alla homepage.

**Nazionali giovanili**: la pagina `/nazionali/` legge `data/competitions.json` — ogni competizione (U15/16, U17, U19, U21, mondiali, Road to 2030) ha una pagina di dettaglio con formula, albo d'oro, calendario completo con risultati di tutte le partite, i giocatori osservati e tutte le news collegate. Le news si collegano in tre modi: tag esplicito `competitions` nel frontmatter (suggerito dal validatore, modificabile in dashboard), parole chiave nel titolo, o giocatori della rosa. Aggiorna il file quando escono date ufficiali; le date indicative sono segnalate nel testo.

**Agente risultati**: `npm run results` cerca su Google News i punteggi delle partite già giocate (di tutte le squadre, non solo dell'Italia) e li scrive nei calendari. I risultati trovati dall'agente sono marcati `_autoResult`: verificali sempre. Il workflow GitHub lo esegue ogni mattina insieme alla raccolta notizie.

**Countdown 2030**: il countdown al Mondiale (8 giugno 2030) è in homepage, nella pagina Nazionali e nella barra del ticker.

**Import da Football Manager**: in FM fai una ricerca giocatori filtrata (nazionalità italiana, età), personalizza la vista con colonne Nome/Club/Ruolo/Età e stampa come "pagina web". Poi: `node pipeline/import-fm.mjs percorso/del/file.html`. I nuovi giocatori vengono aggiunti con l'etichetta `_imported` da verificare a mano. Non pubblicare sul sito i valori di potenziale di FM: sono dati proprietari di Sports Interactive.

## Deploy su GitHub Pages

1. Crea un repo GitHub e fai push di questa cartella su `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Aggiorna `site` in `astro.config.mjs` con l'URL del sito.
4. (Facoltativo) Il workflow `collect.yml` raccoglie candidate ogni mattina e le committa nel repo.

## Note

- Gli articoli attuali sono **esempi redazionali** creati per il lancio: verificane i dettagli prima di pubblicare.
- La pipeline usa Google News RSS (nessuna API key). Rispetta le fonti: il sito pubblica sintesi con link all'articolo originale.
