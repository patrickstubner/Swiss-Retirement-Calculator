# STATUS.md – Stand 15.11.2026, Basis b2f5b8a (Version 1.4.0)
## Aktuelles Ziel
Gesetzesänderungen sollen ein reines Datenupdate mit geprüftem Ergebnis-Diff sein. Regeljahr 2027 bis 1.1.2027 vollständig.
## Erledigt
- Regel-Check November: Quellensteuer Bund Kapital 2027, AHV-Tabellen 2027 verifiziert (1.3.9, 02.11.2026)
- Architekturprüfung lokal ohne Cloud Agent (15.11.2026, /workspace/retirement-architektur)
- RR-1 BVG-Mindestzins 2027 = 2 % (Bundesratsentscheid 04.11.2026), Version 1.3.10 (PR #35 gemergt, live seit 15.11.2026)
- RR-2 Schlüssel `bvg.mindestzins` / `bvg.mindestzinsVorjahr` ohne Jahreszahl (PR #35, live)
- RR-3 AGENTS/ARCHITECTURE/STATUS, Index-Ordner in .gitignore
- RR-4 Golden-Master (8 Referenzhaushalte je Regeljahr, `npm run golden:update`)
- RR-5 Regel-Prüftests T-02/T-03 mit Ausnahmelisten
- RR-6 `scripts/regeljahr-diff.mjs`
- RR-7 nur Charakterisierungstests; Regeljahr im Link und Hinweis bei neuerem Schema zurückgestellt (ändert Verhalten)
- Sicherheitsprüfung 15.11.2026 in docs/SECURITY.md: keine Schwachstellen
- Homescreen-App (PWA): Manifest, Icons, Service Worker (Startseite Netzwerk zuerst), Version 1.4.0, Sicherheitsprüfung in docs/SECURITY.md
## In Arbeit
- Keine offene Arbeit. 1.3.10 ist live (PR #35). 1.4.0 Homescreen-App über PR `feat/pwa-homescreen`.
## Offen / Entscheide nötig (wer?)
- RR-7 Produktteil (Feld `r` im Link, Hinweis bei `v > SCHEMA_VERSION`): eigener PR mit UI-Text? – Patrick
- ADR-001 bis ADR-004 annehmen? – Patrick
- Kantonstarife 2027: warten auf ESTV, heute nur mit Code-Änderung möglich – Patrick/Entwickler
- AHV 2030 und Hinterlassenenrenten: beobachten, noch nicht rechtskräftig
## Bekannte Probleme / Risiken
- R-01: Kantons-/Länder-/QST-Daten nicht versioniert
- R-03: ein Regelstand für die ganze Projektion, Ad-hoc-Felder für künftige Reformen
- Alter lokaler Klon /workspace/ruhestandsrechner divergiert, nicht verwenden
## Genutzte lokale Tools & vermiedene Cloud-Agent-Nutzung
- codebase-memory-mcp: Hotspots (ladeRegeln 58, simuliere 42 Fan-in), Aufrufer von simuliere (29). Geschätzt ~30k Token gespart
- rg/ast-grep: Suche nach hartkodierten Gesetzeswerten (0 Treffer im core) und Jahreszahl-Schlüsseln
- Graphify-CLI (--code-only/--no-label): 97 Cluster, Überblick; geringer Zusatznutzen
