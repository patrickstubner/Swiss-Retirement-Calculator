# ARCHITECTURE.md – Swiss Retirement Calculator (Stand 16.11.2026, Commit 0724fba)

## Überblick
```
src/rules/<jahr>.json ─┐            (Ziel ADR-001: regeln/<jahr>/{bund,kantone,laender,qst}.json)
data/*-2026.json ──────┤ ladeRegeln(jahr) → Regeln (nur Werte; Quelle/Stand bleiben für Anzeige)
                       ▼
src/core (rein): simuliere · ahv · bvg · steuern · kantonsTarife · quellensteuer · entnahme · krisen · montecarlo · solver · umkehr
                       ▼
src/ui: Schritte · Auswertung · state.ts (URL #s=… / localStorage, Schema 15) · validierung.ts
```

## Regeln und Daten
- `src/rules/<jahr>.json`:
  - Bundesregeln, 143 Werte, je `{ value, source, stand, status, hinweis? }`.
  - Struktur von 2026 = Schema für alle Jahre (Typprüfung).
  - `pruefeRegeln` läuft beim Laden.
- **Jahr:**
  - `ladeRegeln(jahr)` nimmt die jüngste Datei mit Jahr ≤ angefragt.
  - Fehlt das Jahr oder sind Werte fortgeschrieben, zeigt die App ein Banner.
  - `regeljahr.yml` prüft wöchentlich.
- **Heute (Abweichung, ADR-001):** Kantone, Länder und QST-Tarife werden statisch aus `data/*-2026.json` importiert und sind nicht pro Jahr versioniert.
- **Heute (Abweichung, ADR-002):** Künftige Änderungen stehen als Ad-hoc-Felder (`abJahr`, `…2027`, `satzAb2028`). Das Ziel sind Zeitreihen `ab[]` mit `gueltigAb`, aufgelöst pro Simulationsjahr.

## Gesetzesänderung einpflegen (Zielprozess)
1. Amtliche Quelle finden (BSV, ESTV, Fedlex, Kanton) und unter `docs/quellen.md` eintragen.
2. Den Wert in der Regeldatei des Jahres setzen bzw. einen `ab[]`-Eintrag hinzufügen, Status `verifiziert`.
3. `node scripts/regeljahr-diff.mjs 2026 2027` ausführen und den Bericht in den PR kopieren.
4. `npm run golden:update` ausführen und den Ergebnis-Diff fachlich prüfen.
5. Version erhöhen und den CHANGELOG ergänzen.
6. Code ändert sich nur bei einer neuen Mechanik.

## Zustand und Links
- Der Haushalt wird als `{ v: 15, h }` per lz-string im Fragment `#s=` oder in localStorage gespeichert.
- Ältere Versionen werden in `normalisiere` ergänzt.
- Limits: Hash 20 000 Zeichen, JSON 1 000 000 Zeichen.
- Geplant: Regeljahr `r` im Link (ADR-004).

## PWA (ab 1.4.0)
- `manifest.webmanifest`, Icons und Service Worker `sw.js`, beim Build aus `scripts/pwa-lib.mjs` erzeugt. Startseite, Manifest und Icons zuerst aus dem Netz, gehashte Dateien aus dem Cache, Cache pro Version.

## Deploy
- GitHub Pages bei Push auf main (Build-Job mit Guards, Lint, Typecheck, Tests).
- `security.yml` (Secret-Scan, Datenschutz, Versionsregel)
- `regeljahr.yml` (wöchentlich)

## Entscheide
ADR-001 (Regelstand bündelt alles), ADR-002 (gültig-ab-Zeitreihen), ADR-003 (Golden-Master pro Regelstand), ADR-004 (Regelstand im Link). Alle vorgeschlagen am 15.11.2026, noch nicht im Repo (offen, siehe STATUS.md).

## Redesign prototype

`prototype/` holds a clickable UX proposal for a future redesign. It is static HTML/CSS/JavaScript, excluded from the app lint, tests and production build, and is not served on the app's GitHub Pages. Preview (Cloudflare Worker): https://ruhestandsrechner-prototyp.pstubner.workers.dev/. Agents must not deploy the Worker.

## Weitere Doku
`docs/konzept.md`, `docs/umsetzungsplan.md`, `docs/quellen.md`, `docs/kantone.md`, `docs/laender.md`, `docs/krisen.md`, `docs/auslandsszenarien.md`, `docs/schnell-vergleich.md`, `docs/vorlesen.md`, `docs/SECURITY.md`, `CONTRIBUTING.md`.
