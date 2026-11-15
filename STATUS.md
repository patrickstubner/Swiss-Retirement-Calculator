# STATUS.md – Stand 15.11.2026, Basis aa7e842 (Version 1.3.10)
## Aktuelles Ziel
Gesetzesänderungen sollen ein reines Datenupdate mit geprüftem Ergebnis-Diff sein. Regeljahr 2027 bis 1.1.2027 vollständig.
## Erledigt
- Regel-Check November: Quellensteuer Bund Kapital 2027, AHV-Tabellen 2027 verifiziert (1.3.9, 02.11.2026)
- Architekturprüfung lokal ohne Cloud Agent (15.11.2026, /workspace/retirement-architektur)
- RR-1 BVG-Mindestzins 2027 = 2 % (Bundesratsentscheid 04.11.2026), Version 1.3.10 (lokaler Branch, 15.11.2026)
- RR-2 Schlüssel `bvg.mindestzins` / `bvg.mindestzinsVorjahr` ohne Jahreszahl (lokaler Branch, 15.11.2026)
## In Arbeit
- Branch `chore/regelstand-netze-2027` (lokal, nicht gepusht): RR-3 bis RR-7. Nächster Schritt: Patricks Ja zum Push/PR.
## Offen / Entscheide nötig (wer?)
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
