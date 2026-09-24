# Ruhestandsrechner Schweiz

> **Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?**

Statische Web-App (GitHub Pages) für Einzelpersonen und Ehepaare in der Schweiz: AHV, Pensionskasse, Säule 3a,
ausländische Renten, freies Vermögen, Ausgaben und Steuern werden Jahr für Jahr in heutigen Franken simuliert. Der
Rechner sucht das **früheste Rücktrittsalter**, bei dem das Vermögen bis zum gewählten Planungsalter reicht.

**Live:** https://patrickstubner.github.io/Swiss-Retirement-Calculator/

Alle Berechnungen laufen ausschliesslich im Browser. Es gibt keinen Server, keine Cookies und kein Tracking. Die
Eingaben stehen im URL-Fragment (`#s=…`, wird nicht an den Server gesendet) und – nur nach ausdrücklicher Zustimmung –
im `localStorage` des Geräts.

## Wichtiger Hinweis

Dieser Rechner dient ausschliesslich der unverbindlichen Information und Orientierung. Er **ersetzt keine persönliche
Finanz-, Steuer-, Rechts- oder Vorsorgeberatung**. Massgebend sind allein die Verfügungen und Auskünfte der zuständigen
Ausgleichskasse, Ihrer Pensionskasse (Reglement und Vorsorgeausweis), der Steuerbehörden sowie die geltenden Gesetze.
Die Berechnungen beruhen auf vereinfachten Modellen, auf Ihren Eingaben und auf den gesetzlichen Werten mit Stand 2026.
Gesetze, Renten, Steuertarife und Zinsen können sich ändern. Für die Richtigkeit, Vollständigkeit und Aktualität der
Ergebnisse wird keine Haftung übernommen. Nicht-kommerzielles Projekt.

## Funktionsumfang (Version 0.1)

- Haushalt: Einzelperson oder Ehepaar; Planungshorizont (Lebensende) Standard **120**, frei wählbar bis 999.
- Jede Person mit vollständig eigenen Angaben: Geburtsjahr/-monat, Geschlecht, Lohn, Rücktrittsalter, AHV, PK, 3a,
  ausländische Renten, Vermögen und Wohneigentum (Verkehrswert, optionale Hypothek).
- **Vereinfachung:** Das gesamte Vermögen gilt als an der Börse angelegt (Marktrendite). Wohneigentum wird wie an der
  Börse angelegtes Kapital behandelt (Nettowert = Verkehrswert − Hypothek); Eigenmietwert, Unterhalt und
  Verkaufskosten sind nicht berücksichtigt. Die Vermögenssteuer (effektiver Satz) umfasst den Nettowert zum
  Verkehrswert; der kantonale Steuerwert folgt mit den Kantonsdaten.
- AHV: Referenzalter nach Jahrgang/Geschlecht (inkl. Übergang Frauen 1961–1963), Rentenformel Skala 44 oder Eingabe
  aus der Rentenvorausberechnung, Teilrente, Vorbezug/Aufschub (Tabellen MB 3.04, reduzierte Sätze der
  Übergangsgeneration), Rentenzuschlag, Plafonierung 150% für Ehepaare, 13. AHV-Rente.
- AHV-Beiträge für Nichterwerbstätige nach Tabelle 2026 (bei Frühpensionierung bis zum Referenzalter).
- Pensionskasse: Altersguthaben, Sparbeiträge (Betrag oder BVG-Minimum), Verzinsung, Umwandlungssatz, Kapital/Rente-Mix.
- Säule 3a: Guthaben, Einzahlungen (Maximum 2026), Bezug bei Erwerbsaufgabe.
- Ausländische Renten pro Person (z.B. Brasilien): Betrag, Währung, Zahlungen/Jahr, Wechselkurs, Startalter,
  Indexierung, in der Schweiz steuerbar ja/nein.
- Steuern: **direkte Bundessteuer exakt nach Tarif 2026** (Einkommen und Kapitalleistungen zu 1/5). Kantons- und
  Gemeindesteuern: Auswahl aller 26 Kantone, vorläufig mit **effektiven Sätzen als Eingabe (Näherung)** – exakte
  Tarife folgen (zuerst ZH und AG).
- Ergebnis: frühestes Rücktrittsalter (Einzelperson, Ehepaar gemeinsam oder nur eine Person), Vermögensverlauf als
  Diagramm und Tabelle, Renten- und Kapitalübersicht, Quellenliste mit Status jedes Regelwerts.

Geplant: kantonale Tarife, Wegzug ins Ausland (Quellensteuer, DBA), historische Krisenszenarien, Monte Carlo,
Sterbetafeln. Siehe `docs/konzept.md`.

## Quellen

Alle gesetzlichen Werte stehen versioniert in `src/rules/2026.json` – jeder Wert mit `value`, `source`, `stand` und
`status` (`verifiziert` oder `offen`). Die Recherche mit URLs ist in `docs/quellen.md` dokumentiert. Wichtigste
Quellen: BSV «Beträge gültig ab 1.1.2026», Merkblätter der Informationsstelle AHV/IV (3.01, 3.04, 2.03), AHVG/BVG/DBG
(fedlex), ESTV (Tarife direkte Bundessteuer 2026, RS 2-216/2-217), BFS.

## Entwicklung

Voraussetzung: Node.js ≥ 22.12 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver: http://localhost:3000/Swiss-Retirement-Calculator/
npm test          # Unit-Tests (Vitest)
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
npm run lint      # Biome (Lint + Format-Prüfung)
npm run typecheck # TypeScript strict
npm run screenshots -- http://localhost:4173/Swiss-Retirement-Calculator/  # Mobile-Screenshots (Playwright)
```

Technik: Rsbuild, React, TypeScript (strict), uPlot (Diagramm), lz-string (URL-Zustand), Vitest, Biome.
Deployment: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`, Basis-Pfad `/Swiss-Retirement-Calculator/`).

### Struktur

```
src/core/    reine Rechenfunktionen (AHV, BVG, Steuern, NE-Beiträge, Simulation, Solver) + Tests
src/rules/   versionierte Regelwerte (2026.json) mit Quelle/Stand/Status, Loader und Schema-Prüfung
src/data/    Standardwerte, Kantonsliste (später Länder-/Kantonsdaten)
src/ui/      React-Oberfläche (mobile-first)
docs/        Konzept und Quellen
```

## Lizenz

MIT – siehe [LICENSE](LICENSE). Historische Marktdaten (JST Macrohistory, CC BY-NC-SA 4.0) sind noch nicht enthalten.
