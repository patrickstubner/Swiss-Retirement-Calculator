# Ruhestandsrechner Schweiz – Produkt- und Technikkonzept

Version 0.1 · Stand 24.09.2026 · Arbeitstitel «Ruhestandsrechner»

> Kernfrage: **«Wann kann ich aufhören zu arbeiten – und reicht mein Vermögen?»**
> Statische Web-App (GitHub Pages), mobile-first, für Einzelpersonen und Ehepaare. Alle Berechnungen laufen im Browser, es gibt keinen Server und die Daten verlassen das Gerät nicht.
> Alle gesetzlichen Werte stammen aus `quellen.md` (Wert, URL, Stand). Nicht verifizierte Werte sind dort als **OFFEN** markiert und werden in der App nicht fest eingebaut.

---

## 0. Leitprinzipien

1. **Regeln als Daten:** Alle Grenzwerte, Sätze und Tarife liegen versioniert in `rules/2026.json` (später `2027.json` usw.), jeweils mit Quelle und Stand pro Wert. Der Code enthält keine Zahlen. Jährliche Updates bestehen damit aus einem JSON-Diff und angepassten Tests.
2. **Transparenz vor Scheingenauigkeit:** Jede Zahl im Ergebnis lässt sich aufklappen («Wie gerechnet?»). Vereinfachungen werden angezeigt.
3. **Heutige Franken:** Ergebnisse werden standardmässig real (Kaufkraft heute) angezeigt, nominal ist umschaltbar.
4. **Konservative Voreinstellungen** (z.B. Planung bis Alter 100, Kosten der Anlagen berücksichtigt).
5. **Datenschutz:** kein Tracking, keine Cookies, keine externen Aufrufe zur Laufzeit.

---

## (a) Funktionsumfang

### MVP (Version 1)
- **Haushalt:** eine Person oder ein Ehepaar (2 Personen, gemeinsame Vermögensrechnung).
- **AHV-Schätzung pro Person:**
  - Rentenformel Art. 34 AHVG (Skala 44) aus einem geschätzten mdJE oder direkte Eingabe der Rente aus dem IK-Auszug bzw. der Rentenvorausberechnung.
  - Beitragslücken → Teilrente (ca. 1/44 pro fehlendes Jahr).
  - Plafonierung Ehepaar 150% (3'780/Mt), Verwitwetenzuschlag 20% (vereinfacht).
  - 13. AHV-Rente (1/12 Jahresrente, Dezember).
  - Vorbezug (1–2 Jahre, monatsgenau, Kürzungstabelle) und Aufschub (1–5 Jahre, Zuschlagstabelle). Teilvorbezug/-aufschub erst in V2.
  - Übergangsgeneration Frauen Jg. 1961–1969: gestaffeltes Referenzalter, reduzierte Kürzungssätze, Rentenzuschlag (nur ohne Vorbezug).
- **Pensionskasse pro Person:**
  - Altersguthaben heute, künftige Sparbeiträge (Eingabe oder BVG-Minimum aus koordiniertem Lohn × Altersgutschrift), Verzinsung (Default BVG-Mindestzins 1,25%, änderbar).
  - Umwandlungssatz als Eingabe (Default 6,8% nur als Hinweis auf das Obligatorium; Hinweis «umhüllende Kassen oft deutlich tiefer»).
  - Bezugsalter 58–70 (Validierung gegen Reglement: Eingabe «frühestes Alter gemäss Reglement»).
  - Bezugsform Rente / Kapital / Mix (Kapitalanteil %; gesetzlich mind. ¼ des Obligatoriums möglich, mehr gemäss Reglement).
  - Geplante Einkäufe mit Warnung bei Kapitalbezug innert 3 Jahren.
  - Ehegattenrente (Default 60% der Altersrente, als Eingabe).
- **Säule 3a:** Guthaben, jährliche Einzahlungen bis zur Pensionierung (Maximalwerte 2026 als Grenze), Anzahl Konten, Bezugsjahre gestaffelt (frühestens RA−5, spätestens RA bzw. RA+5 bei Erwerbstätigkeit).
- **Freies Vermögen:** Wertschriften, Konto, optional selbstbewohnte Liegenschaft (Wert, Hypothek, Zins, Nebenkosten; kein Verkauf im MVP).
- **Ausgaben:** Lebenshaltung pro Jahr (heute), Phasen: aktiv bis 75 / ruhiger ab 75 / Pflege ab 85 (Faktoren einstellbar), Einmalausgaben.
- **Steuern (Wohnsitz CH):**
  - Direkte Bundessteuer exakt nach Tarif 2026 (Einkommen und Kapitalleistungen 1/5).
  - Kantons- und Gemeindesteuer im MVP vereinfacht: effektiver Einkommenssteuersatz, Vermögenssteuer-Promille und Kapitalbezugssatz (%) als Nutzereingaben, mit Link zum ESTV-Steuerrechner zur Ermittlung.
  - AHV-Nichterwerbstätigenbeiträge bei Frühpensionierung exakt nach Tabelle 2026.
- **Simulation:** jährliche Cashflow-Simulation von heute bis Alter 100 (einstellbar 90–110).
  - Modus 1: deterministisch (feste Rendite und Inflation).
  - Modus 2: historischer Replay (alle Startjahre, Krisen-Presets).
- **Kernergebnis:** «Frühestes Rücktrittsalter, bei dem das Vermögen bis Alter X reicht» (deterministisch bzw. in Y% der historischen Startjahre).
- **Diagramme:** Vermögensverlauf (Band bzw. Fächer), Einkommensquellen pro Jahr (gestapelt), Steuern/Abgaben pro Jahr.
- **Speichern:** Zustand im URL-Fragment (teilbarer Link, keine Serverübermittlung) und optional localStorage (Opt-in). Export/Import als JSON-Datei.

### Später (V2+)
- Monte Carlo (Bootstrap aus historischen Jahren und/oder parametrisch), Erfolgswahrscheinlichkeit, Perzentile.
- Langlebigkeits-Wahrscheinlichkeiten aus den BFS-Kohortensterbetafeln (Überlebenskurve, «Vermögen reicht mit Z% Wahrscheinlichkeit lebenslang», gemeinsame Überlebenswahrscheinlichkeit von Paaren).
- Kantonale Steuertabellen für ausgewählte Kantone (Kapitalbezug und Einkommen/Vermögen, vorberechnet).
- Teilpensionierung (Pensum-Reduktion), AHV-Teilvorbezug/-aufschub, PK-Teilbezüge in bis zu 3 Schritten.
- Wegzug ins Ausland: Zielland, Quellensteuer auf PK/3a-Kapital und -Renten (Sitzkanton der Vorsorgeeinrichtung, z.B. SZ), DBA-Rückforderbarkeit gemäss ESTV 2-217, Art. 25f FZG (EU/EFTA-Obligatorium), freiwillige AHV, Währungsrisiko.
- Liegenschaft verkaufen/verkleinern, Eigenmietwert-Wegfall ab 2029, WEF.
- Entnahmestrategien (fester realer Betrag, Prozent vom Vermögen, Leitplanken nach Guyton-Klinger), Anlagestrategie nach Alter.
- Erbschaft/Schenkung, Kinderrenten, IV/Todesfall-Szenarien, Mehrsprachigkeit (FR/IT/EN), PWA/offline.

---

## (b) Eingaben

Progressive Offenlegung: **Schnellstart** mit ca. 8 Feldern, danach **Details** pro Bereich. Jedes Feld hat einen Default, eine Erklärung (ℹ︎) und die Quelle.

### Haushalt
| Feld | Typ | Default |
|---|---|---|
| Konstellation | alleinstehend / verheiratet (eingetragene Partnerschaft = verheiratet) | alleinstehend |
| Wohnkanton, optional Gemeinde | Auswahl | – |
| Planungshorizont (Alter der jüngeren Person) | 90–110 | 100 |
| Ziel-Erfolgsquote Y | 50–100% | 90% |
| Lebenshaltungskosten heute (Jahr, netto nach Steuern) | CHF | – |
| Ausgabenphasen (Faktoren ab 75 / ab 85) | % | 100 / 90 / 110 |
| Einmalausgaben / -einnahmen (Jahr, Betrag, z.B. Erbschaft) | Liste | – |
| Anlagestrategie freies Vermögen | Aktienanteil % / Obligationen / Cash, Kosten (TER) % | 50/40/10, 0,5% |
| Annahmen deterministisch | Rendite nominal, Inflation | aus historischen Mitteln, gut sichtbar anpassbar |
| Wohneigentum (optional) | Wert, Hypothek, Zinssatz, Unterhalt % | – |

### Pro Person (1 bzw. 2×)
| Bereich | Felder |
|---|---|
| Person | Geburtsdatum (Monat/Jahr), Geschlecht (für Referenzalter der Übergangsjahrgänge und Sterbetafel) |
| Erwerb | Bruttolohn heute, erwartete reale Lohnentwicklung, gewünschtes Stopp-Alter (oder «frühestes suchen»), optional Pensum-Reduktion ab Alter (V2) |
| AHV | Variante A: Rente gemäss Rentenvorausberechnung (CHF/Mt, empfohlen). Variante B: Schätzung aus mdJE (Default: aktueller Lohn, gedeckelt), Beitragsjahre bzw. Lücken, Erziehungsgutschriften ja/nein. Bezugsalter (Vorbezug/Aufschub in Monaten). Frauen 1961–1969: Hinweis auf Zuschlag bzw. reduzierte Kürzung |
| Pensionskasse | Altersguthaben heute, davon Obligatorium (optional; aus dem PK-Ausweis), jährlicher Sparbeitrag AN+AG, Projektionszins, Umwandlungssatz im Bezugsalter (gemäss Ausweis), frühestes Bezugsalter laut Reglement, Kapitalanteil %, geplante Einkäufe (Jahr, Betrag), Ehegattenrente % |
| Freizügigkeit | Guthaben, Bezugsalter (RA−5 bis RA) |
| Säule 3a | Guthaben, Anzahl Konten, jährlicher Beitrag, Nachzahlungen, Bezugsjahre |
| Freies Vermögen | Wertschriften, Konto (bei Paaren gemeinsam erfassbar) |
| Steuern (MVP) | effektiver Grenz- oder Durchschnittssatz Kanton/Gemeinde, Kapitalbezugssatz Kanton (%), Vermögenssteuer ‰ |

Validierung: harte Grenzen aus `rules/2026.json` (z.B. 3a-Maximum, AHV-Vorbezug frühestens 63 bzw. 62, PK-Bezug frühestens 58, Aufschub bis 70), mit verständlichen Fehlermeldungen.

---

## (c) Berechnungslogik

### c.1 Zeitraster und Phasen
- **Jahresschritte** (Kalenderjahre) ab dem aktuellen Jahr bis zum Horizont. Rentenbeginn-Monate werden anteilig berücksichtigt (AHV beginnt am 1. des Folgemonats).
- Phasen pro Person: **Erwerb** → **Frühpension/Überbrückung** (kein Lohn, NE-Beiträge, ggf. PK-Vorbezug) → **Rente** (AHV + PK + Entnahmen) → **Hochaltrig** (Ausgabenfaktor, optional Pflege).
- Bei Paaren laufen zwei Personen-Zeitachsen in einem Haushaltsbudget. Todesfall-Szenario (V2): Verwitwetenrente, Plafond entfällt, Ehegattenrente PK.

### c.2 Reihenfolge pro Jahr t
1. **Indexierung:** Ausgaben mit Inflation; AHV-Renten mit Annahme «Mischindex ≈ Inflation + x» (Default: Inflation, da die Anpassung 2027 OFFEN ist); PK-Renten nominal fix (Default 0% Teuerungsausgleich).
2. **Einkommen:** Lohn (bis Stopp-Alter), AHV, PK-Rente, Übergangszuschlag, Kapitalbezüge (PK/FZ/3a) als Zufluss ins freie Vermögen.
3. **Abgaben:** AHV/IV/EO 5,3% und ALV 1,1% (bis 148'200) auf dem Lohn; BVG-Sparbeitrag AN (wandert ins PK-Guthaben); NE-Beitrag ab Stopp bis RA (Tabelle MB 2.03, Bemessung Vermögen + 20× Renteneinkommen, bei Paaren hälftig; Befreiung, wenn der Ehegatte ≥ 1'060 aus Erwerb zahlt; + Verwaltungskostenzuschlag).
4. **Steuern:**
   - Bund Einkommen: Tarif Art. 36 DBG auf steuerbarem Einkommen (Renten 100%, Lohn, Vermögensertrag). Abzüge im MVP vereinfacht (Pauschale bzw. 3a/PK-Einkauf abziehbar).
   - Bund Kapital: Summe aller Kapitalleistungen des Jahres (beide Ehegatten) × Tarif/5.
   - Kanton/Gemeinde: MVP effektive Sätze (Eingabe); V2 Tariftabellen.
   - Vermögenssteuer: Promille × Reinvermögen (MVP).
5. **Saldo** = Einnahmen − Ausgaben − Abgaben − Steuern. Ein Überschuss wird investiert, ein Defizit dem freien Vermögen entnommen (Reihenfolge: Cash → Wertschriften; Liegenschaft wird im MVP nicht angetastet).
6. **Rendite:** Vermögen × (1 + r_t) gemäss Modus (deterministisch / historisch / MC), abzüglich Kosten. PK-Guthaben vor Bezug mit PK-Zins, 3a mit eigener Annahme.
7. **Kennzahlen:** Vermögen real/nominal; «Ruin», wenn das freie Vermögen < 0 ist und Renten die Ausgaben nicht decken (Jahr und Alter merken).

### c.3 Regel-Funktionen (reine Funktionen, einzeln getestet)
- `ahvReferenzalter(geburt, geschlecht)` → Jahre+Monate (Übergangsjahrgänge 1961–1963).
- `ahvRenteSkala44(mdJE)` → Formel Art. 34 AHVG, gerundet gemäss Rententabelle (Stufen 1'512 → Test gegen Tabelle 2025).
- `ahvTeilrente(rente, beitragsjahre)` → Skala = Jahre/44 (vereinfacht; exakter Bruchteil Art. 52 AHVV in V2).
- `ahvVorbezug(monate, jahrgang, geschlecht, mdJE)` → Kürzung (ordentliche Tabelle bzw. reduzierte Tabelle Übergangsgeneration).
- `ahvAufschub(monate)` → Zuschlag gemäss Tabelle.
- `ahvRentenzuschlag(jahrgang, mdJE, skala, vorbezug)` → 0/50/100/160 × Anteil.
- `ahvPlafonierung(rente1, rente2)` → max. 150% der Maximalrente, proportional gekürzt.
- `ahv13(renteJahr)` → Jahresrente/12.
- `neBeitrag(vermoegen, renteneinkommen, verheiratet)` → Tabelle 2026 + Verwaltungskosten.
- `bvgKoordinierterLohn(lohn)`, `bvgAltersgutschrift(alter)`, `pkProjektion(...)`, `pkRente(guthaben, uws)`.
- `einkaufSperrfristVerletzt(einkaeufe, kapitalbezuege)` → Warnung.
- `dbgEinkommen(steuerbar, zivilstand, kinder)` und `dbgKapital(betrag, zivilstand)` = Tarif/5.
- `quellensteuerKapitalBund(betrag, zivilstand)` (V2), `quellensteuerKapitalKanton(kanton, betrag)` (V2, nur verifizierte Kantone).

### c.4 Rendite- und Inflationsmodi
1. **Deterministisch:** konstante nominale Renditen je Anlageklasse und Inflation; zusätzlich Stress-Presets («−30% im 1. Rentenjahr»).
2. **Historischer Replay:** Die realen Jahresreihen (Aktien, Anleihen, Cash, Inflation) eines Landes werden ab Startjahr s abgespielt, für alle s mit genügend Länge. Reicht die Reihe nicht bis zum Horizont, wird zyklisch fortgesetzt (Standard) oder die Auswertung auf die verfügbaren Jahre beschränkt (einstellbar, mit Hinweis). Ergebnis: Anteil erfolgreicher Startjahre, schlechtestes Startjahr, Verteilung.
   - **Krisen-Presets** (Startjahr, Land):
     - Grosse Depression: US ab 1929.
     - Stagflation: CH/US ab 1966, 1969 oder 1973.
     - Japan: ab 1990.
     - Schweizer Immobilienkrise: CH ab 1989/1990 (housing_tr).
     - Dotcom: CH/US ab 2000.
     - Finanzkrise: CH/US ab 2007/2008.
     - Option: Renditen des Auslands mit Schweizer Inflation kombinieren («Was wäre, wenn die Schweiz wie Japan 1990»).
3. **Monte Carlo (V2):** Block-Bootstrap (Blöcke von 5–10 Jahren, erhält Autokorrelation und Stagflationsphasen) aus dem Länderpool; 1'000–10'000 Pfade im Web Worker, reproduzierbarer Seed. Optional stochastische Lebensdauer aus Kohortensterbetafel (Tod zufällig gezogen; Paar: beide unabhängig).

### c.5 «Frühestes Rücktrittsalter»
- Suche über das Stopp-Alter a (monatlich oder jährlich, von heute bis 70; bei Paaren wahlweise gemeinsam, mit festem Altersabstand oder als 2D-Raster).
- Erfolg(a) = Anteil der Pfade (historische Startjahre bzw. MC-Pfade), in denen das freie Vermögen bis Alter X ≥ 0 (oder ≥ Reserve) bleibt.
- Ergebnis: kleinstes a mit Erfolg(a) ≥ Y%. Da der Erfolg in a in der Regel monoton steigt, genügt eine Bisektion (mit Absicherung durch linearen Scan bei Nicht-Monotonie wegen Stufen wie der 3-Jahres-Sperre).
- Zusätzlich wird eine **Sensitivitätstabelle** angezeigt: Stopp-Alter × Ausgabenniveau → Erfolgsquote (Heatmap).
- Mit Sterbetafel (V2): «Wahrscheinlichkeit, dass das Geld vor dem Tod ausgeht» (Lebensdauer-gewichtet) statt fixem Alter X.

### c.6 Kapital vs. Rente (Vergleichsansicht)
- Break-even-Alter: kumulierte PK-Rente (nach Steuern) vs. Kapital (nach Kapitalsteuer) plus Rendite.
- Einflussfaktoren: Umwandlungssatz, Rendite, Inflation (die PK-Rente ist nominal fix), Lebenserwartung (Sterbetafel), Ehegattenrente, Steuern, Vererbbarkeit.
- Aufteilung auf Jahre: Kapitalbezüge beider Partner und 3a-Konten über Jahre verteilen, um die Progression zu brechen (Hinweis auf kantonale Praxis und die 3-Schritte-Regel Art. 13a BVG).

### c.7 «Was fällt beim Aufhören (bzw. Wegzug) weg?» – Infokarte
- Beim Stopp der Erwerbsarbeit entfallen: AHV/IV/EO 5,3%, ALV 1,1% (bis 148'200), BVG-Sparbeiträge, 3a-Einzahlungen (ohne Erwerbseinkommen nicht erlaubt) und die Einkommenssteuer auf dem Lohn.
- Neu dazu kommen NE-Beiträge bis zum RA (530 bis 26'500 pro Jahr + Verwaltungskosten) und Steuern auf Kapitalbezügen und Renten (100%).
- Nach einem Wegzug ins Ausland (V2) entfallen die Schweizer Einkommens- und Vermögenssteuer auf Weltvermögen (Ausnahmen: wirtschaftliche Zugehörigkeit, z.B. CH-Liegenschaft, Details OFFEN).
  - PK-/3a-Leistungen unterliegen der Quellensteuer (Sitzkanton der Vorsorgeeinrichtung + Bund), die je nach DBA rückforderbar ist (ESTV 2-217).
  - Die AHV ist ins Ausland zahlbar (CH/EU/EFTA/Abkommensstaaten). Keine Schweizer Quellensteuer auf AHV-Renten ist abgeleitet, aber OFFEN.
  - Im Wohnsitzstaat wird in der Regel neu besteuert (nicht Teil der App, Hinweis).

### c.8 Bekannte Vereinfachungen im MVP (in der App offengelegt)
- Kantons- und Gemeindesteuern nur über effektive Sätze; keine exakten Abzüge.
- AHV-Teilrente linear 1/44, keine exakte Einkommensaufwertung, kein Splitting im Detail (Eingabe der Rentenvorausberechnung empfohlen).
- PK: Obligatorium/Überobligatorium nur wo nötig (¼-Regel); Umwandlungssatz eingegeben.
- Keine Pflegeheim-/EL-Logik (nur Hinweis auf EL-Lebensbedarf 20'670 / 31'005).

---

## (d) Tech-Stack

| Bereich | Vorschlag | Begründung |
|---|---|---|
| Build | **Vite** + **TypeScript** (strict) | schnell, statischer Output, einfache GitHub-Pages-Basis-URL |
| UI | **Preact** (+ Signals) oder alternativ Svelte | ~4 kB, React-kompatible API, grosses Ökosystem; genügt für Formulare und Charts |
| Styling | CSS mit Custom Properties oder Pico.css / Open Props, mobile-first, dunkler Modus | kein schweres Framework, gute Lesbarkeit auf dem Handy |
| Charts | **uPlot** (Zeitreihen, sehr leicht und schnell) oder Apache ECharts (reicher, grösser); Empfehlung: uPlot + eigene kleine SVG-Heatmap | Performance mit vielen Pfaden auf Mobilgeräten |
| Rechenkern | reines TS-Modul `core/` ohne DOM-Abhängigkeit; Simulationen im **Web Worker** (Comlink) | UI bleibt flüssig; der Kern ist separat testbar |
| Zahlen | Franken als Zahlen mit Rundung an definierten Stellen (Steuern auf 100 Fr. abrunden usw.); keine Dezimal-Library nötig | Genauigkeit auf Franken genügt |
| Regeln/Daten | `public/data/rules/2026.json` (Werte + Quelle + Stand), `public/data/history/{ch,us,jp,...}.json`, `public/data/mortality/ch-kohorten.json`; JSON-Schema + Zod-Validierung | Nachvollziehbarkeit, jährliches Update ohne Code |
| Daten-Build | Node-Skripte in `scripts/` (JST-XLSX → JSON, BFS-PxWeb-API → JSON), einmalig bzw. manuell ausgeführt, Ergebnisse eingecheckt | keine Laufzeitabhängigkeit von externen APIs |
| Tests | **Vitest** – Unit-Tests pro Regel-Funktion mit Referenzwerten aus offiziellen Tabellen (Rententabellen, Kürzungstabellen, DBG-Tarifbeispiele, NE-Tabelle); Property-Tests (fast-check) für Monotonie; Playwright-Smoke-Test (mobiler Viewport) | Regelkorrektheit ist das Kernversprechen |
| Qualität | ESLint, Prettier, TypeScript strict, Bundle-Budget (< 200 kB gz ohne Daten) | Wartbarkeit |
| Deploy | **GitHub Actions**: Lint → Test → Build → `actions/deploy-pages` | Standardweg für Pages |
| Zustand | URL-Fragment (`#s=` komprimiert mit lz-string, versioniertes Schema) für teilbare Links; localStorage nur nach Opt-in; JSON-Export/-Import | Daten bleiben im Browser; das Fragment wird nicht an den Server gesendet |
| PWA (optional) | vite-plugin-pwa, offline nutzbar | App-Gefühl auf dem Handy |
| i18n | Texte von Anfang an in `de-CH.json` ausgelagert | spätere FR/IT/EN günstig |
| Barrierefreiheit | semantisches HTML, Tabellen-Alternative zu jedem Chart, Tastaturbedienung | Pflicht für ein Finanztool |

Ordnerstruktur (Vorschlag):
```
ruhestandsrechner/
  docs/            konzept.md, quellen.md
  public/data/     rules/2026.json, history/*.json, mortality/*.json
  scripts/         build-history.ts, build-mortality.ts
  src/core/        ahv.ts, bvg.ts, saeule3a.ts, steuern.ts, ne-beitraege.ts, simulation.ts, suche.ts
  src/worker/      sim.worker.ts
  src/ui/          Komponenten, Charts
  tests/           *.test.ts (Referenzfälle mit Quellenangabe)
  .github/workflows/deploy.yml
```

Format der historischen Daten (Beispiel):
```json
{ "country": "CH", "source": "JST Macrohistory R6", "license": "CC BY-NC-SA 4.0",
  "fields": ["year","eq_tr","bond_tr","bill_rate","housing_tr","cpi_infl"],
  "rows": [[1929, -0.12, 0.05, 0.03, 0.02, 0.00], "..."] }
```
Die Zahlen im Beispiel sind nur Platzhalter. Dazu kommt `scenarios.json` mit den Krisen-Presets (Name, Land, Startjahr, Kurzbeschreibung).

---

## (e) Disclaimer (Entwurf)

> **Wichtiger Hinweis**
> Dieser Rechner dient ausschliesslich der unverbindlichen Information und Orientierung. Er **ersetzt keine persönliche Finanz-, Steuer-, Rechts- oder Vorsorgeberatung**. Massgebend sind allein die Verfügungen und Auskünfte der zuständigen Ausgleichskasse, Ihrer Pensionskasse (Reglement und Vorsorgeausweis), der Steuerbehörden sowie die geltenden Gesetze.
> Die Berechnungen beruhen auf vereinfachten Modellen, auf den von Ihnen eingegebenen Daten und auf den gesetzlichen Werten mit Stand 2026 (siehe Quellenverzeichnis). Gesetze, Renten, Steuertarife und Zinsen können sich ändern. Historische Renditen und Szenarien sind keine Prognose für die Zukunft; auch Ergebnisse mit hoher «Erfolgswahrscheinlichkeit» bieten keine Garantie.
> Ihre Eingaben werden nur in Ihrem Browser verarbeitet und nicht an uns oder Dritte übermittelt. Für die Richtigkeit, Vollständigkeit und Aktualität der Ergebnisse wird keine Haftung übernommen.
> Datenquellen: Bundesamt für Sozialversicherungen, Informationsstelle AHV/IV, ESTV, BFS, Jordà-Schularick-Taylor Macrohistory Database (CC BY-NC-SA 4.0) u.a. – siehe Quellen.

---

## (f) Offene Produktfragen an den Auftraggeber

1. **Kantone:** Welche Kantone sollen exakte Steuern erhalten (Wohnkanton, z.B. ZH/ZG/SZ/BE)? Reicht im MVP ein effektiver Satz als Eingabe?
2. **Sprache(n):** nur Deutsch (de-CH) oder später auch FR/IT/EN?
3. **Wegzug:** Ist ein Wegzug ins Ausland Teil der Planung? Wenn ja, welche Zielländer (z.B. DE, AT, ES, PT, IT, FR, TH, US) und welcher Sitzkanton der Vorsorge-/Freizügigkeitseinrichtung?
4. **Monte Carlo:** gewünscht schon im MVP oder erst V2? Methode: historischer Bootstrap (empfohlen) oder parametrisch?
5. **Langlebigkeit:** fixes Planungsalter (z.B. 100) reicht, oder Wahrscheinlichkeiten aus BFS-Sterbetafeln (V2)?
6. **Lizenz/Nutzung:** Wird die App je kommerziell genutzt (Werbung, Beratungsmandate)? Die JST-Daten sind **nicht kommerziell** (CC BY-NC-SA) und die ShareAlike-Pflicht betrifft die abgeleiteten Daten-Dateien. Alternativ: nur BFS/SNB-Daten plus eigene Aufbereitung.
7. **Datenaktualität:** JST endet 2020. Sollen die Jahre 2021–2025 aus anderen Quellen ergänzt werden (Lizenz klären) oder genügt 1870–2020?
8. **Lokale Speicherung:** Darf localStorage (Opt-in) verwendet werden, und sind teilbare Links mit allen Finanzdaten im URL-Fragment in Ordnung (Datenschutz-Hinweis)?
9. **Name** der App, Domain (github.io oder eigene Domain), Logo?
10. **Repository:** Name (z.B. `ruhestandsrechner`), öffentlich oder privat (GitHub Pages bei privaten Repos erfordert einen kostenpflichtigen Plan), Lizenz des Codes (z.B. MIT)?
11. **Zielgruppe/Tiefe:** Laien mit Schnellstart oder Fortgeschrittene mit allen Detailfeldern? Braucht es einen Druck-/PDF-Bericht?
12. **Selbständigerwerbende und Teilzeit:** im Scope (anderer AHV-Satz, 3a «gross», kein BVG)?
13. **Wohneigentum:** Liegenschaft im MVP nur als Kosten oder schon Verkauf/Umzug sowie die Eigenmietwert-Abschaffung ab 2029?
14. **Konkubinatspaare:** abbilden (keine Plafonierung, getrennte Steuern) oder nur Ehepaare?
15. **Jährliche Pflege:** Wer aktualisiert `rules/<Jahr>.json` (Rentenanpassung 2027 und neue Kürzungssätze sind noch OFFEN)?

---

## Anhang: Umgang mit OFFEN-Werten
- In `rules/2026.json` hat jeder Wert `status: "verifiziert" | "offen"`. Offene Werte werden nur als Default einer Nutzereingabe mit ⚠︎-Hinweis verwendet oder weggelassen.
- Aktuell OFFEN (Details in `quellen.md`):
  - AHV-Rentenanpassung 2027.
  - Neue Vorbezugs- und Aufschubsätze ab frühestens 2027.
  - BVG-Mindestzins 2027 (Empfehlung 1,75%).
  - Maximum freiwillige AHV 2026 (vermutlich 25'250).
  - Quellensteuersätze aller Kantone ausser SZ.
  - Offizielle LU-Quelle für den Vorsorgetarif.
  - Maschinenlesbare kantonale Tarife bzw. Nutzungsbedingungen des ESTV-Rechners.
  - Keine CH-Quellensteuer auf AHV-Renten im Ausland (abgeleitet).
  - Besteuerung von CH-Liegenschaften nach Wegzug.
  - Lizenzen Shiller/SNB/Pictet.
  - JST-Fortschreibung nach 2020.
