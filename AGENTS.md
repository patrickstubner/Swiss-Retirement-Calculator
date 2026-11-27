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
- `corepack enable`, dann `pnpm install --frozen-lockfile` (`.npmrc`: ignore-scripts)
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `node scripts/datenschutz-guard.mjs`, `node scripts/secret-scan.mjs`, `node scripts/email-guard.mjs --range origin/main..HEAD`
- `pnpm audit --audit-level=high` und `pnpm audit --prod --audit-level=high` (CI-Workflow `security`)

## Projektregeln
- **Gesetzeswerte nur in Regeldateien:**
  - Jeder Wert hat `source` (URL), `stand` und `status` (verifiziert/offen/geplant).
  - Keine Beträge oder Sätze im Code.
  - Keine Jahreszahl im Schlüssel. Datumsabhängige Werte gehören in `ab[]` mit `gueltigAb`.
- Jede Regeländerung bringt einen Golden-Master-Diff mit (`pnpm run golden:update`), im PR erklärt.
- Werte ohne amtliche Quelle bleiben `offen`, mit dem Hinweis «Fortgeschrieben».
- Versionsregel: Jede Änderung erhöht die Version (CONTRIBUTING.md).
- **Paketmanager: nur pnpm** (Version in `packageManager`, über `corepack enable`). Kein `npm`, kein `yarn`, kein `package-lock.json`. Fehlt ein Paket, wird es sauber in `package.json` eingetragen, kein `shamefully-hoist`. `.npmrc` setzt `ignore-scripts=true` (Sicherheitshaltung CA-3).
- **Mindestalter neuer Paketversionen: 4 Tage.** `pnpm-workspace.yaml` setzt `minimumReleaseAge: 5760` (Minuten): pnpm installiert keine Version, die jünger ist (Schutz vor kompromittierten Releases). Die Zeile nie senken oder entfernen. Ausnahme nur, wenn eine Sicherheitslücke sich anders nicht beheben lässt: das Paket gezielt unter `minimumReleaseAgeExclude` eintragen, mit Kommentar (CVE/GHSA, Datum), im PR melden und nach 4 Tagen wieder entfernen. Dependabot hat `cooldown` von mindestens 4 Tagen. Das gilt für alle Agents (Cursor, Antigravity, weitere).
- Keine persönlichen Daten in Repo oder Beispielen (Datenschutz-Guard).
- Sicherheit: docs/SECURITY.md.
- Die App soll als PWA auf dem Homescreen installierbar sein (wie PadelCounter und Travel Talk). Das Icon (Sonnenuntergang mit Strand, Palmen, Liegestuhl und frei wehender Schweizer Flagge ohne Stab) ist vom Projektinhaber genehmigt.
- Gesetzesänderungen sollen als Datenänderung in den Regeldateien ins bestehende Produkt fliessen, nicht als Code. Der Rechner ersetzt keine Finanzberatung.
- Der Datenschutz-Guard braucht die Wortliste (gesalzene Hashes) lokal in `lokal/datenschutz-woerter.json` oder in `DATENSCHUTZ_LISTE`. Sie liegt nicht im Repo und darf nie committet werden; ohne sie meldet der Guard «übersprungen».
- **Versionsregel gilt auch für reine Doku-PRs** (CONTRIBUTING.md): `pnpm version <neu> --no-git-tag-version`, CHANGELOG-Eintrag, eine Zeile in `docs/SECURITY.md`. Commit-Autor nur mit der GitHub-noreply-Adresse.

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
- Verwundbare Libraries auf die nächste sichere Version heben. Bei einem grossen oder brechenden Sprung (Major) vorher den Projektinhaber fragen.
- Updates und offene Risiken in docs/SECURITY.md nachführen.
- Keine Geheimnisse und keine personenbezogenen Daten ins Repo (das Repo ist öffentlich).

### Prüfung und Merge
- Jede Code-Änderung, jeder Merge und jedes Update (auch grüne Dependabot-PRs) wird von Stabschef unabhängig geprüft (Entscheid Projektinhaber, 16.11.2026).
- Vor jedem Merge oder Push auf `main` den Head-SHA an Stabschef geben und auf das Ok warten. Merge nur mit ausdrücklichem Ok des Projektinhabers.
- Keine bezahlten Dienste und kein On-Demand ohne Ja des Projektinhabers.
- Merge immer als Squash-Merge mit `--match-head-commit <SHA>`. Autor und Committer nur mit der GitHub-noreply-Adresse des Repo-Kontos.

## Zusammenarbeit mehrerer Agents (Cursor, Google Antigravity, weitere)

Gilt für alle Agents und Menschen, die an diesem Repo arbeiten. Google Antigravity liest diese `AGENTS.md` im Repo-Stamm automatisch (Rules-Doku: https://antigravity.google/docs/rules); eine zweite Regel-Datei gibt es bewusst nicht, damit nichts doppelt gepflegt wird.

### Branches und PRs
- **Ein Branch pro Aufgabe und Agent.** Zwei Agents arbeiten nie auf demselben Branch. Branch-Name nach Muster `<typ>/<kurzer-name>` (z. B. `feat/…`, `fix/…`, `docs/…`), Basis immer aktuelles `main`.
- **Änderungen nur per Pull Request.** Kein direkter Push auf `main`, kein Force-Push auf fremde Branches. Vor dem Merge geht der Head-SHA an Stabschef; auf dessen Ok warten. Gemergt wird erst nach dem ausdrücklichen Ja des Projektinhabers. Agents ohne direkten Zugang zu Stabschef (z. B. Antigravity) nennen den Head-SHA im PR und mergen nicht (Details: «Prüfung und Merge»).
- Im PR den Head-SHA nennen. Kleine PRs mit einem Thema; fremde Branches und PRs nicht anfassen.

### Branch hygiene (27 November 2026)
Merged or unused branches are deleted. Only `main`, heads of open pull requests, and branches that are actively being worked on remain. Delete pull-request branches immediately after merge (`delete_branch_on_merge` is enabled). Unmerged work that may still have value is first preserved as a tag `archive/<name>`.

`main` is protected. Changes reach `main` only through a pull request with green CI, reviewed by Stabschef and merged via squash on the exact reviewed head. No direct commits, no direct push, no force-push, and never delete `main`. This is the working rule for every agent; do not assume GitHub already enforces it in every repository.

New working rules from the project owner are always added to `AGENTS.md` in every repository and in the `agent-skills` repository.

### GitHub issues (27 November 2026)
New GitHub issues are always written in English, even when communication with the project owner is in German. Existing issues are left unchanged.

### Language on GitHub (27 November 2026)
Everything committed to this repository is in English: code, identifiers and variable names, code comments, commit messages, PR titles and descriptions, issues, templates and all docs (README, AGENTS, ARCHITECTURE, STATUS, CHANGELOG, NOTICE, SECURITY, and others). This applies even when the owner speaks German. Chat with the owner stays German. Existing German docs and code are not translated or renamed ad hoc; that is coordinated separately per repo.

### Sicherheitsprüfung nach jeder Codeänderung
Nach jeder Code-Erstellung oder -Änderung, **bevor weitergebaut wird**, kurz prüfen und im PR (Abschnitt «Sicherheit») bzw. in der `SECURITY`-Notiz des Repos festhalten:
- Eingabevalidierung und Injection (XSS, SQL/Command, Pfade, Prototype Pollution, Deserialisierung)
- Geheimnisse und Zugangsdaten (Code, Konfiguration, Git-Historie, Logs)
- Berechtigungen und Zugriffskontrolle
- Abhängigkeiten und Versionen (direkt und indirekt, CDN, GitHub Actions): `pnpm audit`, verwundbare Libraries auf die nächste sichere Version heben; bei Major-Sprung vorher den Projektinhaber fragen
- Fehlermeldungen und Logs mit sensiblen Daten
- Neue Angriffsflächen (Endpunkte, Schnittstellen, Dateizugriff, Weiterleitungen, CSP/Header)

Schwachstellen mit **Schweregrad** (kritisch / hoch / mittel / niedrig) und Fix-Vorschlag melden, bevor weitergebaut wird. Nichts als «sicher» bezeichnen, was nicht geprüft wurde.

### Übergabe: STATUS.md
- Am Ende **jeder Aufgabe** `STATUS.md` nachführen: was getan wurde, was offen ist, **Commit-Hash**, auf dem der Stand beruht, und welche lokalen Tools genutzt wurden. So kann der nächste Agent einsteigen, ohne alles neu zu lesen.
- `ARCHITECTURE.md` nachführen, wenn sich Struktur oder Entscheide ändern. Keine Werte erfinden: Unbelegtes steht als «offen» da.
- Ergebnisse lokaler Analysen (Hotspots, Aufrufer, Abhängigkeiten) kurz in `STATUS.md`; rohe Index-Ordner (`.codegraph/`, `graphify-out/`, `.serena/`, `.codebase-memory/`) bleiben lokal und stehen in `.gitignore`.

### Verbote
- **Keine Secrets, API-Keys, Tokens oder `.env`-Dateien ins Repo.** Auch nicht in MCP-Konfigurationen: `.agents/mcp_config.json` und `~/.gemini/…` liegen nur lokal (`.agents/mcp_config.json` steht in `.gitignore`).
- **Keine kostenpflichtigen Dienste, Abos, Deploys oder Käufe** ohne ausdrückliches Ja des Projektinhabers. Im Zweifel stoppen und fragen.
- Keine personenbezogenen Daten ins Repo, wenn es öffentlich ist.

### Lokale MCP-Server (Empfehlung für Antigravity und andere lokale Agents)
- **Sinnvoll:** GitHub (Repos, PRs, Issues), Graphify (Struktur-Graph) und `codebase-memory-mcp` (Aufrufer, Impact, Architektur; spart Tokens).
- **Nicht nötig:** Sentry, Notion, PostHog, Vercel, Netlify. Jeder geladene MCP-Server kostet bei jeder Anfrage Tokens; nur aufnehmen, was beim Coden direkt hilft.
- Antigravity: Konfiguration global in `~/.gemini/config/mcp_config.json` oder pro Workspace in `.agents/mcp_config.json` (nicht committen). Anleitung: https://antigravity.google/docs/mcp

### Lokaler Start
Installation, Start und Tests stehen in `README.md` und im Abschnitt «Befehle» oben. Vor dem ersten Commit `pnpm test` bzw. die dort genannten Prüfungen ausführen.

## Cursor Cloud specific instructions

Cloud Agents starten in einer eigenen Ubuntu-VM, ohne den gemeinsamen Rechner. Diese Hinweise gelten nur dort.

### Zuerst lesen
- AGENTS.md, ARCHITECTURE.md und STATUS.md, in dieser Reihenfolge.
- Sind sie unklar oder nicht aktuell: konkret nachfragen, nicht raten.

### Werkzeuge in dieser Umgebung
Das Install-Skript `.cursor/install-dev-tools.sh` legt im Build bereit:
- `rg` (ripgrep 14.1.1) für Zeilensuche
- `ast-grep` (0.51.2) für strukturelle Suche; auf Linux den Befehl `ast-grep` nutzen, nicht `sg`
- `codebase-memory-mcp` (0.12.1) für Aufrufer, Impact und Architektur. Der Index liegt unter `~/.cache/codebase-memory-mcp/` und wird im Build erzeugt.

Die Binaries liegen nur unter `~/.local/bin` (kein Kopieren nach `/usr/local/bin`, kein `sudo`). Das Skript hängt `~/.local/bin` an PATH in `~/.profile` und `~/.bashrc`. Fehlt ein Befehl in einer Sitzung: `export PATH="$HOME/.local/bin:$PATH"`. `environment.json` setzt PATH nicht selbst: das offizielle Schema erlaubt kein `env`-Feld.

Weitere Tools können später im selben Skript ergänzt werden (Version und SHA-256 pinnen, kein `curl|bash`).

Abhängigkeiten: das Skript erkennt `pnpm-lock.yaml` (`pnpm install --frozen-lockfile --ignore-scripts`, pnpm über corepack mit der in `packageManager` gepinnten Version) oder `package-lock.json` (`npm ci --ignore-scripts`, nur für andere Repos). In diesem Repo gilt pnpm. Node muss die `engines` in `package.json` erfüllen (typisch >= 22); das Skript installiert Node nicht.

### Reihenfolge bei Struktur-Fragen
1. STATUS.md und ARCHITECTURE.md.
2. Index-Tool, bevor ganze Dateien gelesen werden:
   - `codebase-memory-mcp cli --quiet list_projects '{}'`
   - `codebase-memory-mcp cli --quiet trace_path '{"project":"<name>","function_name":"<Symbol>","direction":"inbound","depth":2}'`
   - `codebase-memory-mcp cli --quiet get_architecture '{"project":"<name>"}'`
3. `ast-grep` oder `rg` für Muster und exakte Zeichenketten.
4. Dateien nur gezielt lesen.

### Graphify-MCP (gehostet, falls verbunden)
Wenn unter cursor.com/agents ein HTTP-MCP namens `graphify` auf `https://api.graphify.com/mcp` eingerichtet und per OAuth angemeldet ist, den Graphen für Aufrufer, Impact und Tests nutzen (`list_repositories`, `graphify_find`, `graphify_callers`, `graphify_impact`). Der gehostete Graph zeigt den indexierten GitHub-Stand, keine uncommitteten lokalen Änderungen. Fehlt die Verbindung oder weicht der Stand ab: `codebase-memory-mcp` in dieser VM verwenden.

Nicht `codebase-memory-mcp install` oder `update` ausführen (ändert Agent-Konfigurationen oder lädt Binaries). Index-Ordner `.codegraph/`, `graphify-out/`, `.serena/` und `.codebase-memory/` nicht committen (stehen in `.gitignore` und `.cursorignore`).

### MCP-Liste schlank halten (seit 20.11.2026)
Jeder geladene MCP-Server schickt seine Tool-Beschreibungen bei jeder Anfrage mit und kostet Tokens. Darum lässt `.cursor/environment.json` nur den gehosteten Graphify-MCP zu (`mcpServerAllowlist`, Schema: https://cursor.com/schemas/environment.schema.json). Alle anderen User- und Team-MCP-Server sind für Agents dieser Umgebung gesperrt. Cursor-eigene MCP-Server (z. B. Cursor Cloud MCP) bleiben unberührt.
- `codebase-memory-mcp`, `rg` und `ast-grep` laufen als CLI aus dem Install-Skript und brauchen keinen MCP-Eintrag.
- Einen weiteren MCP-Server nur nach einem Nutzen-Test und nur mit Ok des Projektinhabers in die Allowlist aufnehmen.
- Serena nur nach positivem lokalem Test (Tokenmessung bei Travel Talk, ab 27.11.2026). Dann ersetzt es `codebase-memory-mcp`, es kommt nicht zusätzlich dazu.
- Die Datei wirkt nur, wenn bei der Umgebung auf cursor.com «environment.json location» auf dieses Repo zeigt (https://cursor.com/docs/cloud-agent/setup.md#environment-resolution-order). Sonst denselben Eintrag im Abschnitt «MCP servers» der Umgebung von Hand setzen.
