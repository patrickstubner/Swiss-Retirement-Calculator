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

- **Neutrale Standardwerte:** Alle Beträge sind anfangs leer (0) und frei editierbar – keine Beispielvermögen.
  Gesetzliche Werte (z.B. BVG-Mindestzins) und vorsichtige Annahmen (Rendite, Teuerung) sind vorbelegt und anpassbar.
- Haushalt: Einzelperson oder Ehepaar; Planungshorizont (Lebensende) Standard **120**, frei wählbar bis 999.
- Jede Person mit vollständig eigenen Angaben: Geburtsjahr/-monat, Geschlecht, Lohn, Rücktrittsalter, AHV, PK,
  Freizügigkeit, 3a, ausländische Renten und eigene **Vermögenstöpfe**.
- **Vermögenstöpfe pro Person** mit eigener Rendite und Zugriffsregel:
  - verfügbar: Bargeld/Konten (Zins Bargeld), Wertschriften (Börsenrendite), Sonstiges (eigene Rendite),
    Wohneigentum (Nettowert = Verkehrswert − optionale Hypothek, wie Börsenkapital verzinst);
  - gesperrt: **Pensionskasse** bis zum frühesten Bezugsalter gemäss Reglement (Standard 63, gesetzlich 58–70),
    **Freizügigkeit** und **Säule 3a** frühestens 5 Jahre vor dem Referenzalter, spätestens im Referenzalter
    (bei Weiterarbeit bis 5 Jahre später). Der Wohnkanton beeinflusst nur die Kapitalbezugssteuer.
  - Entnahmen in der Reihenfolge Bargeld → Wertschriften → Sonstiges → Wohneigentum (zuletzt, mit Warnung).
    Kapitalbezüge fliessen in die Wertschriften der Person.
  - **Liquiditätslücke:** Warnung mit Jahren, wenn verfügbares Geld fehlt, obwohl noch gesperrte Vorsorgegelder
    vorhanden sind.
- **Wiederkehrende Posten** (Einnahmen wie Mieteinnahmen, Ausgaben wie Krankenkasse oder Wohnen) mit Start-/Endalter,
  Indexierung und Steuerbarkeit; **Einmalereignisse** (z.B. Erbschaft +, Autokauf −) in einem bestimmten Alter.
- AHV: Referenzalter nach Jahrgang/Geschlecht (inkl. Übergang Frauen 1961–1963), Eingabe der Rente aus der
  Rentenvorausberechnung, Vorbezug/Aufschub (Tabellen MB 3.04, reduzierte Sätze der Übergangsgeneration),
  Rentenzuschlag, Plafonierung 150% für Ehepaare, 13. AHV-Rente.
- **AHV-Schätzhilfe pro Person** (grobe Schätzung, keine verbindliche Auskunft): Jahrgang, Geschlecht, fehlende
  Beitragsjahre bzw. Jahre in der Schweiz, durchschnittliches AHV-Einkommen (heutige CHF), Ehejahre für das Splitting
  (50/50), Jahre mit Erziehungsgutschriften (3 × jährliche Minimalrente, in der Ehe hälftig), Auslandsjahre (erhöhen
  die Schweizer Rente nicht → ausländische Rente separat erfassen). Rentenformel Art. 34 AHVG / Rententabelle Skala 44
  (mdJE auf Tabellenwert aufgerundet), Teilrente vereinfacht linear. Übernahme mit einem Klick ins AHV-Feld, das
  editierbar bleibt. Links zur offiziellen
  [Online-Rentenschätzung ESCAL](https://www.ahv-iv.ch/de/Formulare/Online-Rentensch%C3%A4tzung-ESCAL) und zur
  [individuellen Rentenvorausberechnung](https://www.ahv-iv.ch/de/Sozialversicherungen/Alters-und-Hinterlassenenversicherung-AHV/Rentenvorausberechnung)
  ([Formular 318.282](https://www.ahv-iv.ch/p/318.282.d)). Tests gegen alle 51 Stufen der offiziellen Rententabelle
  und die Berechnungsbeispiele im Merkblatt 3.01.
- AHV-Beiträge für Nichterwerbstätige nach Tabelle 2026 (bei Frühpensionierung bis zum Referenzalter).
- Pensionskasse (Werte manuell aus dem Vorsorgeausweis): Altersguthaben, Sparbeiträge, Verzinsung,
  Umwandlungssatz, Kapital/Rente-Mix, frühestes Bezugsalter gemäss Reglement.
- Säule 3a und Freizügigkeit: Guthaben, Rendite, Einzahlungen (3a-Maximum 2026).
- Ausländische Renten pro Person (z.B. Brasilien): Betrag, Währung, Zahlungen/Jahr, Wechselkurs, Startalter,
  Indexierung, in der Schweiz steuerbar ja/nein.
- Steuern: **direkte Bundessteuer exakt nach Tarif 2026** (Einkommen und Kapitalleistungen zu 1/5). Kantons- und
  Gemeindesteuern: Auswahl aller 26 Kantone, vorläufig mit **effektiven Sätzen als Eingabe (Näherung)** – exakte
  Tarife folgen (zuerst ZH und AG).
- Ergebnis: frühestes Rücktrittsalter (Einzelperson, Ehepaar gemeinsam oder nur eine Person), **gestapeltes
  Diagramm nach Vermögenstopf** (verfügbar/gesperrt, Fehlbetrag), Jahrestabelle (verfügbar, gesperrt, total, Lücke),
  Warnungen (Liquiditätslücke, Wohneigentum angetastet, fehlende Eingaben), Renten- und Kapitalübersicht,
  Quellenliste mit Status jedes Regelwerts.

Vereinfachungen: Wohneigentum wird wie Börsenkapital behandelt (ohne Eigenmietwert, Unterhalt, Verkaufskosten);
Vermögenssteuer auf dem Verkehrswert (effektiver Satz). Barauszahlung der PK vor 58 (Wegzug, Selbstständigkeit) ist
noch nicht abgebildet.

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
