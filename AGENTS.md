# AGENTS.md – Swiss Retirement Calculator
## Projekt
- Zweck: Ruhestands- und Vermögensrechner für die Schweiz (AHV, BVG, 3a, Steuern Bund/Kantone, Wegzug). Statische Web-App, rechnet nur lokal.
- Stack: React 19/TS, Rsbuild, Vitest, Biome, uPlot, lz-string. GitHub Pages.
- Wichtige Ordner:
  - `src/rules` (Regeldateien pro Jahr + Schema)
  - `data/` (Kantone, Länder, QST, Krisen)
  - `src/core` (Rechenkern, rein)
  - `src/ui` (Oberfläche, Zustand)
  - `scripts/` (ESTV-Import, Guards)
- Architektur-Doku: ARCHITECTURE.md, ADRs noch nicht im Repo (siehe STATUS.md), Quellen in docs/quellen.md
- Stand und Plan: STATUS.md

## Befehle (aus package.json und .github/workflows/)
- `npm ci --ignore-scripts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `node scripts/datenschutz-guard.mjs`, `node scripts/secret-scan.mjs`, `node scripts/email-guard.mjs --range origin/main..HEAD`
- `npm audit --audit-level=high` (CI-Workflow `security`)

## Projektregeln
- **Gesetzeswerte nur in Regeldateien:**
  - Jeder Wert hat `source` (URL), `stand` und `status` (verifiziert/offen/geplant).
  - Keine Beträge oder Sätze im Code.
  - Keine Jahreszahl im Schlüssel. Datumsabhängige Werte gehören in `ab[]` mit `gueltigAb`.
- Jede Regeländerung bringt einen Golden-Master-Diff mit (`npm run golden:update`), im PR erklärt.
- Werte ohne amtliche Quelle bleiben `offen`, mit dem Hinweis «Fortgeschrieben».
- Versionsregel: Jede Änderung erhöht die Version (CONTRIBUTING.md).
- Keine persönlichen Daten in Repo oder Beispielen (Datenschutz-Guard).
- Sicherheit: docs/SECURITY.md.

## Arbeitsregeln für Agents

### Vor dem Start
- Vor jedem Cloud-Agent-Start AGENTS.md, ARCHITECTURE.md und STATUS.md lesen. Sie müssen aktuell sein. Fehlt etwas oder ist es unklar: zuerst konkret nachfragen, keinen Cloud Agent starten.
- Zuerst lokal arbeiten, mit den lokalen Tools. Für neue Features oder grössere Umbauten zuerst einen klickbaren Prototyp und eine klare Spezifikation, erst dann einen Cloud Agent.
- Kontext schlank halten: Struktur-Fragen mit den Tools unten beantworten statt ganze Dateien zu lesen. STATUS.md nach jedem Arbeitspaket nachführen.
- Pro grösserem Paket in STATUS.md festhalten: welche lokalen Tools genutzt wurden, wie viel Cloud-Agent-Nutzung das vermieden hat, Rückmeldung zu den Tools.
- Keine Werte erfinden. Was nicht belegt ist, steht als «offen» da.

### Lokale Tools (gemeinsamer Rechner, Anleitung `dev-tools/README.md`)
- codebase-memory-mcp, Standard für «wer ruft X»: `cbm index <pfad>`, dann `cbm callers <projekt> <Symbol> 2`, `cbm get_architecture '{"project":"<projekt>"}'`
- codegraph, wenn Code und Aufrufpfade gebraucht werden: `codegraph explore "<Frage>"`
- Serena für exakte Referenzen (nur eigene Repos): `serena-repl . 's.lsp.find_referencing_symbols("<Symbol>","<Datei>")'`
- ast-grep für Muster: `ast-grep run -p '<Muster>' -l tsx src`
- `rg` für einfache Zeilensuchen
- Graphify: für GitHub-Repos den Connector. Die lokale CLI nur für ungepushten Code und immer mit `--code-only` bzw. `--no-label`, sonst ruft sie ein LLM auf (Kosten, Code verlässt den Rechner).
- Index-Ordner `.codegraph/`, `graphify-out/` und `.serena/` nie committen, sie stehen in `.gitignore`.

### Sicherheit (Dauerregel)
- Nach jeder Code-Erstellung oder -Änderung eine detaillierte Sicherheitsprüfung: Eingabevalidierung, Injection, Geheimnisse und Zugangsdaten, Berechtigungen, Abhängigkeiten inklusive indirekter, CDN und GitHub Actions auf bekannte Schwachstellen, Fehlermeldungen mit sensiblen Daten, Angriffsflächen. Ergebnis mit Schweregrad und Fix-Vorschlag im PR.
- Verwundbare Libraries auf die nächste sichere Version heben. Bei einem grossen oder brechenden Sprung (Major) vorher Patrick fragen.
- Updates und offene Risiken in docs/SECURITY.md nachführen.
- Keine Geheimnisse und keine personenbezogenen Daten ins Repo (das Repo ist öffentlich).

### Prüfung und Merge
- Jede Code-Änderung, jeder Merge und jedes Update (auch grüne Dependabot-PRs) wird von Stabschef unabhängig geprüft (Entscheid Patrick, 16.11.2026).
- Vor jedem Merge oder Push auf `main` den Head-SHA an Stabschef geben und auf das Ok warten. Merge nur mit ausdrücklichem Ok von Patrick.
- Keine bezahlten Dienste und kein On-Demand ohne Patricks Ja.
- Merge immer als Squash-Merge mit `--match-head-commit <SHA>`. Autor und Committer nur mit der GitHub-noreply-Adresse des Repo-Kontos.
