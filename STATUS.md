# STATUS.md – Stand 22.11.2026, Branch `chore/pnpm-audit-fix`, Basis main 4ea31b5 (Version 1.4.7)

## Nachtrag 22.11.2026 (Nachmittag): Umstellung auf pnpm (Version 1.4.7)
Branch `chore/pnpm-audit-fix` (Draft-PR, Basis main 4ea31b5, nicht mergen bis Stabschef-Ok und Ja des Projektinhabers). Kein App-Code, keine Regeländerung, kein Cloud Agent.
- pnpm 10.34.9 (`packageManager`), `pnpm-lock.yaml` aus `pnpm import`, `.npmrc` `ignore-scripts=true`. Workflows `deploy`, `regeljahr`, `security` auf pnpm. Geheimnis-Scan und Datenschutz-Guard nehmen die neue Lockdatei aus.
- Audit: vorher `npm audit` 0, nachher `pnpm audit` 0 (mit und ohne `--prod`). Die Prüfung ist eine Pflicht-Prüfung des Rulesets (`security`); der Check heisst unverändert.
- Geprüft lokal: Lint, tsc, 1094 Tests, Build, Guards, Versions-Check, `pnpm audit`.
- AGENTS.md: Regel «nur pnpm». Offene Dependabot-PRs danach neu bauen lassen.
- Mindestalter neuer Paketversionen 4 Tage: `pnpm-workspace.yaml` mit `minimumReleaseAge: 5760`, Regel in `AGENTS.md` und Sicherheitsnotiz, Dependabot-`cooldown` (mindestens 4 Tage). Lockfile geprüft: alle Pakete älter als 4 Tage (jüngstes: 10,7 Tage). **Übergangsausnahmen in `minimumReleaseAgeExclude` (Kommentar «Übergang Einführung 4-Tage-Regel, entfernen ab 26.11.2026»): keine, weil kein bestehendes Paket jünger als 4 Tage ist.** Sicherheits-Ausnahmen: keine nötig.

## Nachtrag 22.11.2026 (Abend): Korrekturen nach Stabschef-Prüfung (Version bleibt 1.4.6)
Commit `3ce4880`. Nur Doku, kein App-Code, keine Regeländerung, kein Cloud Agent.
- Abschnitt «Zusammenarbeit mehrerer Agents»: vor dem Merge geht der Head-SHA an Stabschef, auf dessen Ok warten, Merge erst nach dem Ja des Projektinhabers.
- CHANGELOG und `docs/SECURITY.md` um diesen Nachtrag ergänzt.

## Nachtrag 22.11.2026: Vorbereitung für lokale Arbeit mit Google Antigravity (Version 1.4.6)
Branch `docs/antigravity-setup` (PR offen, nicht mergen bis Stabschef-Ok und Ja des Projektinhabers). Nur Doku und `.gitignore`, kein App-Code, keine Regeländerung, kein Cloud Agent. `.cursor/` und `.cursorignore` unverändert. Versionsregel erfüllt (1.4.5 → 1.4.6, CHANGELOG, Zeile in `docs/SECURITY.md`).
- `AGENTS.md`: neuer Abschnitt «Zusammenarbeit mehrerer Agents» (ein Branch pro Aufgabe und Agent, nur PRs, Sicherheitsprüfung nach jeder Änderung, STATUS.md mit Commit, keine Secrets, keine Kosten ohne Ja, empfohlene lokale MCP-Server) und ergänzte Projektregeln (PWA/Icon, Gesetzesänderungen als Daten, lokale Wortliste des Datenschutz-Guards, Versionsregel auch für Doku). Antigravity liest `AGENTS.md` automatisch; keine zweite Regel-Datei.
- `README.md`: Abschnitt «Mit Agents arbeiten» (der lokale Start stand schon im Abschnitt «Entwicklung»). `.gitignore`: `.agents/mcp_config.json`.
- Fund beim Datenschutz-Guard mit lokaler Wortliste (auch auf `main` schon vorhanden, CI läuft ohne Liste grün): `AGENTS.md` und `STATUS.md` enthielten den Vornamen des Projektinhabers. In diesem PR durch «Projektinhaber» ersetzt; mit Liste danach 0 Funde.
- Geprüft lokal: tsc, Lint, Tests, Geheimnis-Scan, E-Mail-Guard, Versions-Check, `npm audit` (0 Funde; ab 1.4.7 `pnpm audit`).

## Nachtrag 20.11.2026: MCP-Allowlist für Cloud-Agent-Umgebung
Branch `chore/mcp-allowlist` (Draft-PR, Basis main 53eac9a, nicht mergen bis Stabschef-Ok und Ja des Projektinhabers). Version 1.4.5 (Versionsregel: jeder PR erhöht die Version).
- `.cursor/environment.json`: neu `mcpServerAllowlist` mit genau einem Eintrag, dem gehosteten Graphify-MCP (`https://api.graphify.com/mcp`). Alle anderen User- und Team-MCP-Server sind für Agents dieser Umgebung gesperrt, Cursor-eigene MCP-Server nicht. Feldnamen laut https://cursor.com/schemas/environment.schema.json; die Datei wurde gegen das Schema geprüft.
- AGENTS.md (Cloud-Abschnitt): Regel «MCP-Liste schlank halten; Serena nur nach positivem lokalem Test, dann ersetzt es codebase-memory-mcp».
- Die Datei wirkt nur, wenn «environment.json location» der Umgebung auf cursor.com auf dieses Repo zeigt. Sonst gleichen Eintrag im Dashboard von Hand setzen (Abschnitt «MCP servers» der Umgebung). Ungetestet: kein Cloud Agent gestartet (Kontingent bis 27.11.2026 erschöpft).

## Nachtrag 16.11.2026: Cloud-Agent-Setup (1.4.4)
Branch `chore/cloud-agent-setup` (Draft-PR, nicht mergen bis Stabschef und Projektinhaber Ja sagen).
- `.cursor/environment.json` und `.cursor/install-dev-tools.sh`: ripgrep 14.1.1, ast-grep 0.51.2, codebase-memory-mcp 0.12.1, Versionen und SHA-256 gepinnt. Bei `package-lock.json`: `npm ci --ignore-scripts` (Node laut `.nvmrc`/engines >= 22.12.0).
- Binaries nur unter `~/.local/bin` (kein `sudo`, kein `/usr/local/bin`); PATH setzt das Skript in `~/.profile` und `~/.bashrc`.
- `.cursorignore` für Lockfiles, Build, Screenshots, Index-Ordner. `data/` bleibt im Kontext.
- `.codebase-memory/` in `.gitignore` und `.cursorignore`.
- Abschnitt «Cursor Cloud specific instructions» in AGENTS.md ergänzt.
- Der gehostete Graphify-MCP wird unter cursor.com/agents verbunden, nicht durch diesen PR.

## Aktuelles Ziel
Gesetzesänderungen sollen ein reines Datenupdate mit geprüftem Ergebnis-Diff sein. Regeljahr 2027 bis 1.1.2027 vollständig.
## Erledigt
- Regel-Check November: Quellensteuer Bund Kapital 2027, AHV-Tabellen 2027 verifiziert (1.3.9, 02.11.2026)
- Architekturprüfung lokal ohne Cloud Agent (15.11.2026)
- RR-1 BVG-Mindestzins 2027 = 2 % (Bundesratsentscheid 04.11.2026), Version 1.3.10 (PR #35 gemergt, live seit 15.11.2026)
- RR-2 Schlüssel `bvg.mindestzins` / `bvg.mindestzinsVorjahr` ohne Jahreszahl (PR #35, live)
- RR-3 AGENTS/ARCHITECTURE/STATUS, Index-Ordner in .gitignore
- RR-4 Golden-Master (8 Referenzhaushalte je Regeljahr, `npm run golden:update`)
- RR-5 Regel-Prüftests T-02/T-03 mit Ausnahmelisten
- RR-6 `scripts/regeljahr-diff.mjs`
- RR-7 nur Charakterisierungstests; Regeljahr im Link und Hinweis bei neuerem Schema zurückgestellt (ändert Verhalten)
- Sicherheitsprüfung 15.11.2026 in docs/SECURITY.md: keine Schwachstellen
- Homescreen-App (PWA): Manifest, Icons, Service Worker (Startseite Netzwerk zuerst), Version 1.4.0, Sicherheitsprüfung in docs/SECURITY.md (PR #36 gemergt, live seit 16.11.2026)
- 1.4.1: Erklärtest Steuersprung beim Wegzug nach Portugal (zh-wegzug-pt), Rechnung unverändert (PR #37 gemergt, 16.11.2026)
- 1.4.2: AGENTS.md mit den Arbeitsregeln vom 15./16.11.2026, ARCHITECTURE.md und STATUS.md nachgeführt (PR #38 gemergt `1948ba2`, live seit 16.11.2026)
- 1.4.3: IRS-Sätze Portugal 2026 nach Decreto-Lei 212/2026, Golden Master «zh-wegzug-pt» (PR #39 gemergt `56424b6`, live seit 16.11.2026)
## In Arbeit
- dieser Branch 1.4.4 (Draft-PR, nicht mergen): Cloud-Agent-Setup.
## Offene PRs (16.11.2026, per gh)
- dieser Draft-PR: Ruhestandsrechner 1.4.4, Cloud-Agent-Setup (`chore/cloud-agent-setup`)
## Plan ab 27.11.2026
- Reserve-Kontingent (15–20 %, zusammen mit PadelCounterV2) für kleine Anpassungen.
- Majors (Dependabot) erst ab 27.11., je PR mit Sicherheitsprüfung und Stabschef-Prüfung.
- Regeljahr 2027 bis 1.1.2027 vollständig (Kantonstarife, sobald die ESTV sie publiziert).
## Offen / Entscheide nötig (wer?)
- diesen Draft-PR (1.4.4, Cloud-Agent-Setup) mergen? – Projektinhaber, nach Stabschef-Ok
- RR-7 Produktteil (Feld `r` im Link, Hinweis bei `v > SCHEMA_VERSION`): eigener PR mit UI-Text? – Projektinhaber
- ADR-001 bis ADR-004 annehmen? Sie liegen noch nicht im Repo (nur lokal); als `docs/adr/` übernehmen? – Projektinhaber
- Kantonstarife 2027: warten auf ESTV, heute nur mit Code-Änderung möglich – Projektinhaber/Entwickler
- AHV 2030 und Hinterlassenenrenten: beobachten, noch nicht rechtskräftig
## Bekannte Probleme / Risiken
- R-01: Kantons-/Länder-/QST-Daten nicht versioniert
- R-03: ein Regelstand für die ganze Projektion, Ad-hoc-Felder für künftige Reformen
- Ein alter lokaler Klon auf dem gemeinsamen Rechner divergiert, nicht verwenden; immer frisch von `origin/main` arbeiten
## Genutzte lokale Tools & vermiedene Cloud-Agent-Nutzung
- codebase-memory-mcp: Hotspots (ladeRegeln 58, simuliere 42 Fan-in), Aufrufer von simuliere (29). Geschätzt ~30k Token gespart
- rg/ast-grep: Suche nach hartkodierten Gesetzeswerten (0 Treffer im core) und Jahreszahl-Schlüsseln
- Graphify-CLI (--code-only/--no-label): 97 Cluster, Überblick; geringer Zusatznutzen
- 16.11. (#38, #39): gh, rg, `npm audit`, gitleaks lokal (0 Funde). Kein Cloud Agent.
- 16.11. (1.4.4 Cloud-Agent-Setup): Vorlage-Skript, STATUS/SECURITY nachgeführt, Guards und Tests lokal. Kein Cloud Agent.
