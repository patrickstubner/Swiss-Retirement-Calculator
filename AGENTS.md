# AGENTS.md
## Projekt
- Zweck: Ruhestands- und Vermögensrechner für die Schweiz (AHV, BVG, 3a, Steuern Bund/Kantone, Wegzug). Statische Web-App, rechnet nur lokal.
- Stack: React 19/TS, Rsbuild, Vitest, Biome, uPlot, lz-string. GitHub Pages.
- Wichtige Ordner:
  - `src/rules` (Regeldateien pro Jahr + Schema)
  - `data/` (Kantone, Länder, QST, Krisen)
  - `src/core` (Rechenkern, rein)
  - `src/ui` (Oberfläche, Zustand)
  - `scripts/` (ESTV-Import, Guards)
- Architektur-Doku: ARCHITECTURE.md, ADRs in docs/adr/, Quellen in docs/quellen.md

## Arbeitsregeln für Agents
- Vor jedem Cloud-Agent-Start STATUS.md lesen. Fehlt Kontext, zuerst nachfragen.
- Struktur-Fragen lokal beantworten:
  - `cbm index .`, dann `cbm callers workspace-<pfad> simuliere 2`
  - `codegraph explore "<Frage>"`
  - `serena-repl . 's.lsp.find_referencing_symbols("<Symbol>","<Datei>")'`
- Index-Ordner nie committen: .codegraph/, graphify-out/, .serena/ gehören in .gitignore.
- Befehle:
  - `npm ci --ignore-scripts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `node scripts/datenschutz-guard.mjs`
- **Gesetzeswerte nur in Regeldateien:**
  - Jeder Wert hat `source` (URL), `stand` und `status` (verifiziert/offen/geplant).
  - Keine Beträge oder Sätze im Code.
  - Keine Jahreszahl im Schlüssel. Datumsabhängige Werte gehören in `ab[]` mit `gueltigAb`.
- Jede Regeländerung bringt einen Golden-Master-Diff mit (`npm run golden:update`), im PR erklärt.
- Werte ohne amtliche Quelle bleiben `offen`, mit dem Hinweis «Fortgeschrieben».
- Versionsregel: Jede Änderung erhöht die Version (CONTRIBUTING.md).
- Keine persönlichen Daten in Repo oder Beispielen (Datenschutz-Guard).
- Nach jeder Code-Änderung eine Sicherheitsprüfung mit Schweregrad melden. Merges nur mit ausdrücklichem OK von Patrick.
