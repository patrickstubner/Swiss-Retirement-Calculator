# STATUS.md – Stand 16.11.2026, Basis main 1948ba2 (1.4.2), dieser Branch 1.4.3 (PR #39)
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
## In Arbeit
- #39 (1.4.3, Draft, offen): IRS-Sätze Portugal 2026 nach Decreto-Lei 212/2026, Golden Master «zh-wegzug-pt» −161 CHF/Jahr; auf main 1.4.2 nachgezogen (Merge, kein Rebase).
## Offene PRs (16.11.2026, per gh)
- #39 Ruhestandsrechner 1.4.3: IRS-Sätze Portugal 2026 nach Decreto-Lei 212/2026 (Draft, Merge-Entscheid – Patrick)
## Plan ab 27.11.2026
- Reserve-Kontingent (15–20 %, zusammen mit PadelCounterV2) für kleine Anpassungen.
- Majors (Dependabot) erst ab 27.11., je PR mit Sicherheitsprüfung und Stabschef-Prüfung.
- Regeljahr 2027 bis 1.1.2027 vollständig (Kantonstarife, sobald die ESTV sie publiziert).
## Offen / Entscheide nötig (wer?)
- #39 mergen (IRS Portugal 2026)? – Patrick
- RR-7 Produktteil (Feld `r` im Link, Hinweis bei `v > SCHEMA_VERSION`): eigener PR mit UI-Text? – Patrick
- ADR-001 bis ADR-004 annehmen? Sie liegen noch nicht im Repo (nur lokal); als `docs/adr/` übernehmen? – Patrick
- Kantonstarife 2027: warten auf ESTV, heute nur mit Code-Änderung möglich – Patrick/Entwickler
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
