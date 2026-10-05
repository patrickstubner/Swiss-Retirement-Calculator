# Ruhestandsrechner Schweiz – Produkt- und Technikkonzept

Version 0.1 · Stand 24.09.2026 · Titel «Ruhestandsrechner Schweiz»

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
  - Umwandlungssatz als Eingabe (Vorsorgeausweis, hat immer Vorrang). Ohne Eingabe aufgeteilte Schätzung: 6,8% (Art. 14 BVG) auf den obligatorischen Teil, auf den Rest der durchschnittliche (umhüllende) Umwandlungssatz der Pensionskassen laut OAK BV (2025: 5,17%); obligatorischer Anteil aus BVG-Mindestgutschriften geschätzt oder als «Davon BVG-Altersguthaben» eingegeben.
  - Bezugsalter 58–70 (Validierung gegen Reglement: Eingabe «frühestes Alter gemäss Reglement»).
  - Bezugsform Rente / Kapital / Mix (Kapitalanteil %; gesetzlich mind. ¼ des Obligatoriums möglich, mehr gemäss Reglement).
  - Geplante Einkäufe mit Warnung bei Kapitalbezug innert 3 Jahren.
  - Ehegattenrente (Default 60% der Altersrente, als Eingabe).
- **Säule 3a:** Guthaben, jährliche Einzahlungen bis zur Pensionierung (Maximalwerte 2026 als Grenze), Anzahl Konten, Bezugsjahre gestaffelt (frühestens RA−5, spätestens RA bzw. RA+5 bei Erwerbstätigkeit).
- **Freies Vermögen:** Wertschriften, Konto, optional selbstbewohnte Liegenschaft (Wert, Hypothek; optional Zins, Unterhalt, Eigenmietwert, Vermietung nach dem Wegzug und Verkauf mit Grundstückgewinnsteuer, siehe c.7e).
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
- Verkleinern (Kauf eines kleineren Eigenheims mit Ersatzbeschaffung), WEF. (Verkauf, Wohnkosten und Eigenmietwert-Wegfall ab 2029 sind seit Schema 7 umgesetzt.)
- Leitplanken nach Guyton-Klinger und eine monatliche Umschichtung nach der RETIRE-Studie. Entnahmestrategien (gestaffelter Satz, fester realer Betrag, Prozent vom Vermögen, Annuität, Mehr-Töpfe) sind umgesetzt (Schema 12).
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
| Ausgabenphasen «von–bis» (Detailmodus, Schema 2) | Liste: von, bis (inkl., leer = Lebensende), Betrag heute pro Jahr oder Monat; Bezug Kalenderjahr oder Alter einer Person | – (ohne Phasen: Einzelbetrag) |
| Einzeljahr-Abweichungen | Liste: Kalenderjahr, Betrag heute (ersetzt die Lebenshaltung des Jahres) | – |
| Einmalausgaben / -einnahmen (Jahr, Betrag, z.B. Erbschaft) | Liste | – |
| Anlagestrategie freies Vermögen | Aktienanteil % / Obligationen / Cash, Kosten (TER) % | 50/40/10, 0,5% |
| Annahmen deterministisch | Rendite nominal, Inflation | aus historischen Mitteln, gut sichtbar anpassbar |
| Wohneigentum (optional) | Verkehrswert, Hypothek; bei «Wohnkosten separat»: Zinssatz, Unterhalt (% oder CHF), Eigenmietwert, nach Wegzug leer/vermietet; Verkauf (Zeitpunkt, Anlagekosten, Kaufdatum, Verkaufskosten %, eigener Satz) | – |

### Pro Person (1 bzw. 2×)
| Bereich | Felder |
|---|---|
| Person | Geburtsdatum (Monat/Jahr), Geschlecht (für Referenzalter der Übergangsjahrgänge und Sterbetafel) |
| Erwerb | Bruttolohn heute, erwartete reale Lohnentwicklung, gewünschtes Stopp-Alter (oder «frühestes suchen»), optional Pensum-Reduktion ab Alter (V2) |
| AHV | Variante A: Rente gemäss Rentenvorausberechnung (CHF/Mt, empfohlen). Variante B: Schätzung aus mdJE (Default: aktueller Lohn, gedeckelt), Beitragsjahre bzw. Lücken, Erziehungsgutschriften ja/nein. Bezugsalter (Vorbezug/Aufschub in Monaten). Frauen 1961–1969: Hinweis auf Zuschlag bzw. reduzierte Kürzung |
| Pensionskasse | Altersguthaben heute, davon Obligatorium (optional; aus dem PK-Ausweis), jährlicher Sparbeitrag AN+AG, Projektionszins, Umwandlungssatz im Bezugsalter (gemäss Ausweis), frühestes Bezugsalter laut Reglement, Kapitalanteil %, geplante Einkäufe (Jahr, Betrag), Ehegattenrente % |
| Freizügigkeit | Guthaben, Bezugsalter (RA−5 bis RA) |
| Wegzug | endgültiger Wegzug ab Alter oder Datum, Zielland (EU/EFTA oder nicht), «Barauszahlung bei Wegzug» (Standard an), EU/EFTA: «im neuen Land nicht obligatorisch versichert», Sitzkanton der Vorsorgeeinrichtung (Standard Wohnkanton). Im Detailmodus als eigene Karte **vor** der Pensionskasse im Schritt «Einkommen & Vorsorge» (derselbe Zustand wie im Schritt «Personen», dort zusätzlich die AHV-Angaben); im Modus «Schnell» schlank bei jeder Person (ohne Sitzkanton) |
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
1. **Indexierung:** Ausgaben mit Inflation (alle Eingaben in heutigen Franken; die Simulation rechnet real, d.h. ein Betrag heute entspricht im Jahr t nominal Betrag × Π(1 + Teuerung); Lebenshaltung pro Jahr aus `core/ausgaben.ts`: Einzeljahr → erste passende Phase → Grundbetrag × Faktor ab 75/85); AHV-Renten mit Annahme «Mischindex ≈ Inflation + x» (Default: Inflation; die einmalige Anpassung per 1.1.2027 steht in `rules/2027.json`, die laufende Annahme danach bleibt Inflation); PK-Renten nominal fix (Default 0% Teuerungsausgleich).
2. **Einkommen:** Lohn (bis Stopp-Alter), AHV, PK-Rente, Übergangszuschlag, Kapitalbezüge (PK/FZ/3a) als Zufluss ins freie Vermögen.
3. **Abgaben:** AHV/IV/EO 5,3% und ALV 1,1% (bis 148'200) auf dem Lohn; BVG-Sparbeitrag AN (wandert ins PK-Guthaben); NE-Beitrag ab Stopp bis RA (Tabelle MB 2.03, Bemessung Vermögen + 20× Renteneinkommen, bei Paaren hälftig; Befreiung, wenn der Ehegatte ≥ 1'060 aus Erwerb zahlt; + Verwaltungskostenzuschlag).
4. **Steuern:**
   - Bund Einkommen: Tarif Art. 36 DBG auf steuerbarem Einkommen (Renten 100%, Lohn, Vermögensertrag). Abzüge im MVP vereinfacht (Pauschale bzw. 3a/PK-Einkauf abziehbar).
   - Bund Kapital: Summe aller Kapitalleistungen des Jahres (beide Ehegatten) × Tarif/5.
   - Kanton/Gemeinde: MVP effektive Sätze (Eingabe); V2 Tariftabellen.
   - Vermögenssteuer: Promille × Reinvermögen (MVP).
5. **Saldo** = Einnahmen − Ausgaben − Abgaben − Steuern. Ein Überschuss wird investiert, ein Defizit dem freien Vermögen entnommen (Reihenfolge: Cash → Wertschriften → Sonstiges → Wohneigentum zuletzt, mit Warnung). Ein geplanter Verkauf löst die Liegenschaft am Ende des Verkaufsjahres auf (c.7e).
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
   - **Umgesetzt (PR D, Sept. 2026):** Krisen-Overlay statt vollständigem Replay: gewählte Krisen (Katalog in
     `src/data/krisen.ts`, Kalenderjahr oder X Jahre nach dem Rücktritt, kombinierbar) ersetzen die Annahmen nur in
     den Krisenjahren; danach normale Annahmen. Aktien/Obligationen gemäss `annahmen.aktienanteil`. Details und
     Quellen: `docs/krisen.md`. Nicht umgesetzt: Replay aller Startjahre, ausländische Renditen mit CH-Teuerung.
3. **Monte Carlo (V2):** Umgesetzt (PR D) synchron im Browser mit 300 Läufen (eine Simulation ≈ 1 ms), Varianten
   «Annahmen + wiederkehrende Krisen» (Häufigkeit aus JST) und Block-Bootstrap Schweiz 1900–2024. Ursprünglicher Plan: Block-Bootstrap (Blöcke von 5–10 Jahren, erhält Autokorrelation und Stagflationsphasen) aus dem Länderpool; 1'000–10'000 Pfade im Web Worker, reproduzierbarer Seed. Optional stochastische Lebensdauer aus Kohortensterbetafel (Tod zufällig gezogen; Paar: beide unabhängig).

   - **Umgesetzt (Sept. 2026, Schema 8):** Fächer mit 10., 25., 50., 75. und 90. Perzentil (`MonteCarloErgebnis.p25`,
     `p75`), dieselben Perzentile nominal (`nominal`, pro Lauf mit dessen Teuerung umgerechnet, dann sortiert),
     sortierte Ruin-Alter (`ruinAlterSortiert`) für «mit Wahrscheinlichkeit w reicht das Geld mindestens bis Alter Y»
     (`reichtBisAlter(m, w)` = (1 − w)-Quantil) und optionales Zielvermögen (`zielEndVermoegen`, für die
     Umkehrrechnung: Erfolg nur, wenn das Geld reicht und am Ende mindestens so viel übrig ist).
4. **Darstellung real/nominal (umgesetzt Sept. 2026):** Die Simulation rechnet unverändert real. `JahresZeile` trägt
   `indexBeginn` und `indexEnde` (kumulierte Teuerung des gerechneten Pfads zu Jahresbeginn/-ende). `core/nominal.ts`
   rechnet ein Ergebnis für die Anzeige um: Flüsse × `indexBeginn`, Bestände (Töpfe, Vermögen, Fehlbetrag) sowie
   Verkauf und Grundstückgewinnsteuer (am Jahresende verbucht) × `indexEnde`, Punktwerte der Personen (AHV-Rente beim
   Beginn, PK-Kapital, Barauszahlung …) × Index ihres Jahres. Summen ohne Jahresbezug (Quellensteuer auf Renten,
   Kapitalsteuer im Zielland) bleiben real; die Quellensteuer auf Kapital wird mit dem Index der Barauszahlung
   umgerechnet (Näherung). Umschalter `Haushalt.darstellung` ('real' | 'nominal') im Zustand und im Link (Schema 8).

5. **Jahresübersicht (umgesetzt Sept. 2026):** `JahresZeile.lebenshaltung` (geplante Lebenshaltung des Jahres),
   `ertraege` (reale Wertänderung von Bargeld, Wertschriften und Sonstigem durch Rendite nach Kosten, ohne
   Wohneigentum und Vorsorge) und `ertragsBasis` (Anfangsbestand). Nominal: Ertrag = (Basis + Ertrag) × `indexEnde`
   − Basis × `indexBeginn`. Spalten und CSV in `core/jahresTabelle.ts`; Grafik mit zweiter y-Achse
   (`Serie.rechts`, Skala ab 0) in `ui/components/JahresUebersicht.tsx`. Das angebrochene Startjahr wird nur in der
   Grafik auf 12 Monate hochgerechnet.

### c.5 «Frühestes Rücktrittsalter»
- Suche über das Stopp-Alter a (monatlich oder jährlich, von heute bis 70; bei Paaren wahlweise gemeinsam, mit festem Altersabstand oder als 2D-Raster).
- Erfolg(a) = Anteil der Pfade (historische Startjahre bzw. MC-Pfade), in denen das freie Vermögen bis Alter X ≥ 0 (oder ≥ Reserve) bleibt.
- Ergebnis: kleinstes a mit Erfolg(a) ≥ Y%. Da der Erfolg in a in der Regel monoton steigt, genügt eine Bisektion (mit Absicherung durch linearen Scan bei Nicht-Monotonie wegen Stufen wie der 3-Jahres-Sperre).
- Zusätzlich wird eine **Sensitivitätstabelle** angezeigt: Stopp-Alter × Ausgabenniveau → Erfolgsquote (Heatmap).
- Mit Sterbetafel (V2): «Wahrscheinlichkeit, dass das Geld vor dem Tod ausgeht» (Lebensdauer-gewichtet) statt fixem Alter X.

### c.5b Umkehrrechnung «Wie viel kann ich ausgeben?» (umgesetzt Sept. 2026)
- `src/core/umkehr.ts`: Bisektion auf den Grundbetrag B (Go-go bzw. konstant, heutige CHF, auf CHF 100 abgerundet).
  Die Ausgaben werden als Phasen nach Alter der Referenzperson (jüngere Person = Person des Planungsalters) gesetzt,
  Altersfaktoren 75/85 = 1; übrige Posten, Einmalereignisse, Einzeljahre und separate Wohnkosten bleiben. Die
  Go-go-Phase gilt ab heute (auch vor dem Rücktritt).
- Kurve (`data/ausgabenkurve-2026.json`): bis 74 100 %, 75–84 85 %, ab 85 75 %; optional Pflegeheim: in den Jahren
  ab `pflegeAb` (Standard Planungsalter − 2) zusätzlich CHF 81'000 pro Jahr (eine Person) zum No-go-Betrag.
- Ziel am Planungsalter: Betrag (heutige CHF) oder `startvermoegen(h) × (1 + g)^n` (n = Anzahl simulierter Jahre,
  angebrochenes Startjahr als ganzes; Basis = verfügbares Vermögen ohne gesperrte PK/FZ/3a).
- Erfolg deterministisch: Geld reicht (`erfolg`) und `endVermoegen ≥ Ziel`; Krisen-Optionen werden übergeben (ohne
  Krise, Automatisch, Individuell). Monte Carlo: `erfolgsquote` mit `zielEndVermoegen` ≥ Mindestquote, fester Seed
  (gleiche Zufallszahlen für alle Beträge), höchstens 200 Läufe in der App (Rechenzeit ca. 2–4 s).
- Annahme: Erfolg ist in B monoton fallend (Steuerstufen können kleine Ausnahmen erzeugen; Genauigkeit CHF 100).

### c.5c Todesfall-Szenario «Was passiert, wenn eine Person stirbt?» (umgesetzt Sept. 2026, Schema 9)
- Nur Ehepaare. Einstellung `Haushalt.todesfall` (aktiv, Person, Alter oder Jahr, Ausgabenfaktor, Ehejahre, Kinder,
  Splitting). Sie ändert **keine** Hauptrechnung: `simuliere(h, regeln, { todesfall })` rechnet das Szenario nur, wenn es
  als Option übergeben wird. Ohne Option sind alle Ergebnisse bitgleich wie vorher (Regressionstest).
- `src/core/todesfall.ts` (reine Regelfunktionen): AHV-Witwen-/Witwerrente (80 %, Anspruch), Verwitwetenzuschlag 20 %,
  Rentenvergleich nach Jahressumme (13 × Altersrente vs. 12 × Witwenrente), BVG-Ehegattenrente 60 % bzw. Abfindung
  (3 Jahresrenten), projizierte Invalidenrente für Aktive, Todeszeitpunkt.
- Ablauf in `simulation.ts`: Todesmonat (erster Monat ohne die Person = Beginn der Hinterlassenenleistungen); die
  verstorbene Person hat danach keinen Lohn, keine Beiträge, keine AHV/PK; Plafonierung entfällt; PK-Ehegattenrente
  nominal fix; Freizügigkeit und 3a gehen als Kapital an die überlebende Person; Ausgaben × Faktor (Standard 0,67,
  OFFEN, editierbar); Steuern: Todesjahr Verheiratetentarif, danach Alleinstehende; Wegzug: die AHV-Hinterlassenenrente
  bleibt ins Ausland zahlbar, EL nicht.
- UI (`src/ui/todesfall.ts`, `components/Todesfall.tsx`): Vergleich mit/ohne Todesfall bei gleicher Krisen-Einstellung,
  Geld reicht bis Alter, Endvermögen, Einkommen vor/nach dem Tod, Grafik beider Verläufe, Jahrestabelle mit †,
  Monte Carlo (gleicher Seed mit/ohne) und Matrix «Wer stirbt zuerst?» (A/B mit 70/80/90). Real/nominal folgt dem Schalter.
- Quellen: `docs/quellen.md` Abschnitt 15.

### c.5d Kapitalbezug in den Kantonen und Stiftungssitz (umgesetzt Sept. 2026, Schema 10)
- Frage «Zählt der Sitz der Stiftung?»: bei Wohnsitz in der Schweiz **nein** (Art. 4b Abs. 1 StHG: Wohnsitz bei Fälligkeit),
  bei Wohnsitz im Ausland **ja** (Quellensteuer des Sitzkantons, Art. 4 Abs. 2 lit. e / Art. 35 Abs. 1 lit. g StHG,
  Art. 96 DBG). Herleitung und Quellen: `docs/quellen.md` Abschnitt 16.
- Schema 10: Sitzkanton je Vorsorgeform (`wohnsitzAusland.sitzkantonVorsorge` = PK, `sitzkantonFz`, `sitzkanton3a`;
  leer = wie PK). Ältere Stände rechnen unverändert (ein Sitz für alles).
- `src/core/kantonsVergleich.ts`: Vergleich der 26 Kantone (Wohnsitz CH / Quellensteuer), Strategie «Freizügigkeit in
  Tiefsteuerkanton» (ZG/SZ/NW). UI: `components/Kantone.tsx` (Karte im Ergebnis).
- Regression: Standard-Wohnkanton ZH ändert kein Ergebnis (bitgleich zu Stand vor PR); die 24 Näherungskantone weichen
  wegen der genaueren Kapitalleistungssteuer leicht ab (z.B. BE, ZG ca. 0,8 % der Kapitalsteuer).

### c.5e Wegzug-Vergleich PK/3a (umgesetzt Sept. 2026, kein Schema-Wechsel)
- Karte im Ergebnis: A Wohnsitz bleibt in der Schweiz, B Wegzug Nicht-EU/EFTA (Standard BR), C Wegzug EU/EFTA (Standard PT); je Fall volle Simulation, Tabelle mit Kapital je Quelle, gesperrtem Obligatorium, Quellensteuer am Sitz, Rückforderung, Netto-Kapital, Endvermögen und «Geld reicht bis».
- Regeln: Art. 5/25f FZG (Barauszahlung, EU/EFTA-Sperre des Obligatoriums), ESTV 2-217 (Quellensteuer, Rückforderung, zuständiger Kanton). Quellen: `docs/quellen.md` Abschnitt 17.
- Rückforderung nach dem DBA nur mit Schalter und Zielland-Satz, getrennt nach PK/FZ und 3a. Zielland-Steuer auf Vorsorgekapital: OFFEN (ausser IT).
- Regression: ohne Schalter bit-gleich zu vorher.

### c.5f Staffelung der Kapitalbezüge und Steuer-Tipps (umgesetzt Sept. 2026, Schema 11)
- Schalter «Kapitalbezüge im Plan staffeln» (1–10 Jahre; 3a, Freizügigkeit, optional PK-Kapital). Karte im Ergebnis mit Vergleichstabelle 1–5 Jahre (Steuer auf Kapital, Ersparnis, Endvermögen, Geld reicht bis) und Bezugsjahren.
- Regeln und Quellen: `docs/quellen.md` Abschnitt 18 (Art. 38 DBG; ZH, BE, BL, SG; Art. 13a/13b BVG; Art. 12/16 FZV; Art. 3 BVV 3).
- Steuer-Tipps nur, wo realistisch: kein Staffel-Tipp bei Wegzug (flache Quellensteuer), keiner unter CHF 500 Ersparnis, keiner für das gesperrte Obligatorium; Warnung, wenn das Endvermögen trotz Steuerersparnis sinkt.
- Regression: Staffelung aus = bit-gleich zu vorher.

### c.5g Szenario-Vergleich Version A/B (umgesetzt Sept. 2026, Speicher-Version 2)
- Version A ist die bisherige Eingabe; «Version B anlegen» kopiert sie (tiefe Kopie). Beide Versionen nutzen dieselben Schritte und Formulare (`SchrittInhalt`), je eine Spalte (Desktop ab 1100 px nebeneinander, darunter untereinander). Ohne B bleibt die App unverändert (Regressionstest: Speicherobjekt und Rechnung identisch).
- Karte «Vergleich der Versionen» (`src/ui/szenarien.ts`, `components/Vergleich.tsx`): Endvermögen, Steuern total (Einkommen, Kapital, Vermögen), Ø Nettoeinkommen pro Jahr im Ruhestand (Jahre nach der letzten Erwerbsphase; ohne Kapitalbezüge und Vermögensverzehr), Erfolgsquote und «Geld reicht bis» (Monte Carlo, 9 von 10 Läufen) sowie «Geld reicht bis» ohne Zufall. Je Differenz (B minus A) und «besser» (hoch/tief je Kennzahl; Unterschiede unter CHF 100, 0,5 Prozentpunkten bzw. 0,1 Jahren = gleichwertig). Die Bewertung ist rein rechnerisch, die Gewichtung der Kennzahlen bleibt beim Nutzer.
- Darstellung real/nominal gilt für beide Versionen gemeinsam (sonst nicht vergleichbar).
- Farben und Kennzeichnung: A blau, ausgezogen, Buchstabe im Kreis; B orange, gestrichelt, Buchstabe im Quadrat; Legende und Spaltenköpfe benennen die Version im Text.
- Rechenzeit: Simulation je Version läuft wie bisher verzögert (`useDeferredValue`); Monte Carlo (gleiche Läufe und gleicher Seed für beide, 50–500 Läufe) läuft in einem Web-Worker (`mc.worker.ts`) mit Rückfall auf den Hauptthread; ebenso die Monte-Carlo-Rechnung der Auswertung (150 Läufe) und der Karte «Wiederkehrende Krisen» (mit Fortschritt und Abbruch, `mcLauf.ts`); veraltete Antworten werden verworfen.
- Speichern: B und die Namen liegen im selben Speicherobjekt (`szenarien`, Speicher-Version 2; Version 1 lädt weiter). Der Schalter «Eingaben im Browser speichern» deckt beide ab: aus = alles gelöscht. Export/Import (JSON-Datei, nur lokal, Import normalisiert wie Laden) sichert beide Versionen ausserhalb des Browsers. Geteilte Links (`#s=`) enthalten weiterhin nur Version A.
- Keine neuen Regelwerte oder Quellen (`docs/quellen.md` Abschnitt 19: nur der Hinweis, dass Auftrag V keine Regeln enthält).
- Im Schritt «Ergebnis» zeigt jede Spalte das volle Ergebnis ihrer Version (inkl. Wegzug-, Kantons- und Staffelungs-Karten); der gewünschte Suchmodus «frühestes Rücktrittsalter» gilt für beide Versionen gleich. Geteilte Links und der Suchmodus gehören zur Hauptversion A.

### c.6 Kapital vs. Rente (Vergleichsansicht)
- Break-even-Alter: kumulierte PK-Rente (nach Steuern) vs. Kapital (nach Kapitalsteuer) plus Rendite.
- Einflussfaktoren: Umwandlungssatz, Rendite, Inflation (die PK-Rente ist nominal fix), Lebenserwartung (Sterbetafel), Ehegattenrente, Steuern, Vererbbarkeit.
- Aufteilung auf Jahre: Kapitalbezüge beider Partner und 3a-Konten über Jahre verteilen, um die Progression zu brechen (Hinweis auf kantonale Praxis und die 3-Schritte-Regel Art. 13a BVG).

### c.7 «Was fällt beim Aufhören (bzw. Wegzug) weg?» – Infokarte
- Beim Stopp der Erwerbsarbeit entfallen: AHV/IV/EO 5,3%, ALV 1,1% (bis 148'200), BVG-Sparbeiträge, 3a-Einzahlungen (ohne Erwerbseinkommen nicht erlaubt) und die Einkommenssteuer auf dem Lohn.
- Neu dazu kommen NE-Beiträge bis zum RA (530 bis 26'500 pro Jahr + Verwaltungskosten) und Steuern auf Kapitalbezügen und Renten (100%).
- Nach einem Wegzug ins Ausland (V2) entfallen die Schweizer Einkommens- und Vermögenssteuer auf Weltvermögen (Ausnahme: wirtschaftliche Zugehörigkeit, z.B. CH-Liegenschaft → c.7d).
  - PK-/3a-Leistungen unterliegen der Quellensteuer (Sitzkanton der Vorsorgeeinrichtung + Bund), die je nach DBA rückforderbar ist (ESTV 2-217). **Umgesetzt** für Kapitalleistungen ab dem Wegzug (siehe c.7c); die Rückforderung nur als Hinweis.
  - Die AHV ist ins Ausland zahlbar (CH/EU/EFTA/Abkommensstaaten). Keine Schweizer Quellensteuer auf AHV-Renten ist abgeleitet, aber OFFEN.
  - Im Wohnsitzstaat wird in der Regel neu besteuert (nicht Teil der App, Hinweis).

### c.7c Barauszahlung bei endgültigem Wegzug
- Voraussetzung: Wegzug aktiv, Zielland gewählt, Option «Barauszahlung bei Wegzug» an. Freigabemonat = Wegzugsmonat
  (liegt er in der Vergangenheit: heute). Das PK-Bezugsalter laut Reglement verhindert die Freigabe nicht (Hinweis beim
  Feld); liegt der Wegzug aber am/nach diesem Alter, ist es eine Altersleistung (Art. 2 Abs. 1bis FZG) → ordentlicher Bezug.
- Die Entscheidung trifft `pkWegzugStatus()` in `core/simulation.ts` (Fälle `ohneWegzug`, `ohneBarauszahlung`,
  `landFehlt`, `barauszahlung`, `pensionierung`); die Simulation nutzt sie für die Freigabe und legt sie als
  `PersonInfo.pkWegzug` ab. Die Statuszeile beim Feld «frühester Bezug laut Reglement» formuliert nur daraus
  (`ui/pkWegzugText.ts`), rechnet also nichts eigenes. `feldOhneWirkung`: Barauszahlung auch mit dem tiefsten
  Reglementsalter 58 (Wegzug vor 58 bzw. vor der Erwerbsaufgabe) → Feld ausgegraut/read-only mit Begründung.
- PK: ausserhalb EU/EFTA (oder EU/EFTA mit «nicht obligatorisch versichert») das ganze Guthaben als Kapital; sonst nur
  das Überobligatorium, der obligatorische Teil (Anteil aus `obligatoriumsAnteilBei()`: Feld «Davon BVG-Altersguthaben»
  bzw. Schätzung, bis zum Wegzugsjahr hochgerechnet) wandert in den Freizügigkeitstopf (Bezug ab RA−5). Keine PK-Rente,
  keine weiteren PK-Beiträge.
- Freizügigkeit: bar nur beim Vollbezug; 3a: immer bar (Art. 3 Abs. 2 lit. d BVV 3; EU/EFTA bestätigt durch
  BSV-Mitteilungen Nr. 96 Rz 567). Liechtenstein (`obligatoriumImmerGesperrt`): Obligatorium immer gesperrt.
- Steuern: Kapitalleistungen ab dem Wegzugsmonat mit `quellensteuerKapital()` (Bund QStV-Tarif + Sitzkanton, je Person
  mit Zivilstandstarif), davor wie bisher mit der ordentlichen Kapitalleistungssteuer (Ehepaare zusammengerechnet).
- Ausgabe: `PersonInfo.barauszahlung` (Monat, Beträge, gesperrter Teil, Anteil) und `quellensteuerKapital`; Anzeige in
  der Wegzug-Karte, beim PK-Feld und im Ergebnis. Quellen und OFFEN-Punkte: `docs/quellen.md` Abschnitt 11.

### c.7d Steuern nach dem Wegzug
- CH-Einkommens- und Vermögenssteuer werden mit dem Anteil der Monate mit Wohnsitz Schweiz gewichtet (Paare: CH-Steuer,
  solange eine Person in der Schweiz wohnt). Danach `ziellandSteuer()` (`src/core/zielland.ts`) mit dem Modell aus
  `laender-2026.json` → `steuern` (territorial / keine / tarif), Option (z.B. `it7`, `cy5`, `azoren`) oder eigenem Satz
  (`WohnsitzAusland.steuerSatzZielland`). LI/MT-Ehepaare im selben Land: gemeinsamer Tarif.
- Liegenschaft in der Schweiz nach dem Wegzug: beschränkte Steuerpflicht aus wirtschaftlicher Zugehörigkeit (Art. 4
  Abs. 1 StHG; § 4 Abs. 1 lit. b und § 5 Abs. 2 StG ZH). Gerechnet: Vermögenssteuer des Wohnkantons auf dem Nettowert
  des Wohneigentums, zum Satz des gesamten Vermögens, mindestens zum Satz des Schweizer Teils (§ 6 StG ZH, Fassung
  gemäss ZStB Nr. 49.3 https://www.zh.ch/de/steuern-finanzen/steuern/treuhaender/steuerbuch/steuerbuch-definition/zstb-49-3.html).
  Nicht abgebildet (OFFEN): Steuerwert unter dem Verkehrswert (ZH: 70–100 %, Weisung 2026 Rz. 79–82), Schuldenverlegung
  nach Lage der Aktiven, Steuer im Zielland auf der Liegenschaft (z.B. IT: IVIE; die IVAFE im Modell
  wird vereinfacht auf das ganze Vermögen gerechnet). Mieteinnahmen und Verkauf: c.7e.
- Erstes Jahr ab dem Startmonat (Teiljahr): Einkommenssteuer (Schweiz und Zielland) nach dem Tarif des auf zwölf Monate
  hochgerechneten Einkommens, davon der Anteil der simulierten Monate; Vermögensertrag nur für diese Monate.
- CH-Quellensteuer auf PK-Renten bei `chQstPkRente = 'ja'` (Satz des Sitzkantons, `quellensteuerVorsorgeRentenKantone`);
  `rueckforderbar` → als zurückerstattet angenommen.
- Kapital-QSt: Rückforderung optional (`qstKapitalRueckforderung`), nur mit Zielland-Satz (`kapitalVorsorgeSatz` oder
  `steuerSatzKapitalZielland`). Ausgabe: `PersonInfo.zielland`, `quellensteuerRente`, `quellensteuerKapitalRueckforderung`,
  `kapitalSteuerZielland`. Schema 3 (Migration setzt Standardwerte). Die Zielland-Angaben zählen als Detailwert.


### c.7e Wohneigentum, Wohnkosten und Verkauf (Schema 7)
- **Wertentwicklung:** Der ganze Verkehrswert V entwickelt sich mit der Rendite Wohneigentum (normale Jahre: Annahme
  bzw. ausgeglichene Rendite; Krisenjahre: historische Hauspreise). Mit «Wohnkosten separat» bleibt die Hypothek
  nominal fix (real sinkt sie mit der Teuerung); sonst wächst sie pauschal mit der Renditeannahme (ohne Krise
  identisch zur früheren Rechnung auf dem Nettowert). In einer Hauspreiskrise wirkt dadurch der Hebel: der Nettowert
  fällt stärker als der Hauspreis.
- **Wohnkosten** (nur wenn `haushalt.wohnen.separat`): Hypothekarzins = Hypothek × Satz; Unterhalt in % × V oder
  CHF/Jahr (heutige Franken); Miete CHF/Monat (heutige Franken), solange der Haushalt in der Schweiz wohnt und nicht in
  einer eigenen, nicht verkauften Liegenschaft. Die Wohnkosten sind in `JahresZeile.ausgaben` enthalten.
- **Steuern Selbstnutzung:** bis und mit 2028 Eigenmietwert − Schuldzinsen − Unterhalt im steuerbaren Einkommen
  (nur wenn ein Eigenmietwert erfasst ist); ab 2029 nichts (Reform, Bundesrat 1.4.2026).
- **Nach dem Wegzug:** leer (keine Einkünfte, Kosten laufen weiter) oder vermietet: Mieteinnahmen als Einnahmen;
  steuerbar in der Schweiz Miete − Unterhalt − Zins (ab 2029 Zins nur im Verhältnis Liegenschaft / Gesamtvermögen),
  zum Satz des gesamten Einkommens, mindestens dem Satz des Schweizer Teils (Art. 7 Abs. 1 DBG, § 6 StG ZH);
  vereinfacht mit dem Tarif des Wohnkantons.
- **Verkauf** am Ende des Verkaufsjahres (Rücktritt, Wegzug oder Monat/Jahr): Preis = V nominal; Gewinn = Preis −
  Verkaufskosten − Anlagekosten; Grundstückgewinnsteuer nach `core/grundstueckgewinn.ts` (ZH § 225 inkl. Zuschlag und
  Ermässigung, AG § 109, übrige Kantone Näherung ZH oder eigener Satz); Erlös = V − Verkaufskosten − Steuer − Hypothek
  in die Wertschriften. Anzeige unter «Renten und Kapital» und in der Jahrestabelle (Steuern inkl. GGSt).
### c.7e Nicht erwerbstätige Person (z.B. Familienarbeit)
- `Person.erwerbsstatus = 'nichtErwerbstaetig'`: `gerechnetePerson()` setzt Lohn, Erwerbsaufgabe (Alter 0), PK-Guthaben/
  -Beiträge und 3a-Einzahlungen auf 0 (gespeicherter Zustand bleibt); die Simulation erzwingt Stopp-Alter 0 auch bei
  Vorgaben des Solvers. Beim Paar mit einer nicht erwerbstätigen Person sucht der Solver das Alter der anderen.
- AHV-Schätzung: volle Beitragsjahre (ab Zuzug), eigenes Einkommen aus `frueherErwerb`, Splitting mit dem Ehegatten,
  Erziehungs-/Betreuungsgutschriften. NE-Beiträge und Befreiung (≥ 1'060 durch den Ehegatten) rechnet die Simulation
  pro Jahr (`PersonInfo.neBeitraegeJahre`, `neBefreitJahre`); `nichtErwerbAnnahmen()` erklärt sie. Schema 4.

### c.7b Modus «Schnell» / «Detailliert» und Schätzwerte
- «Schnell» (Standard beim ersten Start ohne gespeicherten Zustand; gespeicherte Wahl und Links mit Detailwerten
  haben Vorrang) zeigt nur die wichtigsten Eingaben; «Detailliert» alle Schritte.
- Felder, die sonst geschätzt werden (AHV-Rente, PK-Guthaben, PK-Sparbeitrag, Umwandlungssatz), tragen pro
  Person eine Markierung `manuell`. Ohne eigene Eingabe setzt `effektiverHaushalt()` den Schätzwert ein;
  der gespeicherte Zustand bleibt unverändert, der Moduswechsel verliert daher nichts.
- Alle Annahmen stehen mit Begründung in `src/core/schaetzwerte.ts` (nur aus `rules/2026.json` abgeleitet).
- Ergebnis: Anzahl geschätzter Werte, Zuzugs-Hinweis zu AHV-Lücken, Sensitivität «Wo sich Genauigkeit lohnt»
  (`src/core/sensitivitaet.ts`, Bandbreiten als Modellannahmen gekennzeichnet).
- Vergleich Schnell vs. Detailliert für Musterhaushalte: `src/core/schnellVergleich.test.ts`.

### c.8 Bekannte Vereinfachungen im MVP (in der App offengelegt)
- Kantons- und Gemeindesteuern nur über effektive Sätze; keine exakten Abzüge.
- AHV-Teilrente linear 1/44, keine exakte Einkommensaufwertung, kein Splitting im Detail (Eingabe der Rentenvorausberechnung empfohlen).
- PK: Obligatorium/Überobligatorium nur wo nötig (¼-Regel); Umwandlungssatz eingegeben.
- Keine Pflegeheim-/EL-Logik (nur Hinweis auf EL-Lebensbedarf 20'670 / 31'005).

---

### c.9 Noch nicht abgebildet (Liste Sept. 2026, priorisiert)
Siehe Abschnitt «Wichtige fehlende Punkte» im Bericht vom 29.9.2026; Kurzfassung: Pflegekosten differenziert
(kantonal, EL), Ergänzungsleistungen, Hinterlassenenleistungen (Witwen-/Witwerrente AHV/PK), Krankenversicherung im
Ausland, Wechselkursrisiko bei Ausgaben in Fremdwährung, gestaffelter Kapitalbezug, Erbschaft/Schenkung, Sterbetafeln.

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
ch-rentenrechner/
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
10. **Repository:** Name (z.B. `Swiss-Retirement-Calculator`), öffentlich oder privat (GitHub Pages bei privaten Repos erfordert einen kostenpflichtigen Plan), Lizenz des Codes (z.B. MIT)?
11. **Zielgruppe/Tiefe:** Laien mit Schnellstart oder Fortgeschrittene mit allen Detailfeldern? Braucht es einen Druck-/PDF-Bericht?
12. **Selbständigerwerbende und Teilzeit:** im Scope (anderer AHV-Satz, 3a «gross», kein BVG)?
13. **Wohneigentum:** erledigt mit Schema 7 (Wohnkosten, Verkauf mit Grundstückgewinnsteuer, Eigenmietwert bis 2028). Offen: Kauf eines Ersatzobjekts, Amortisation, Steuerwert unter dem Verkehrswert.
14. **Konkubinatspaare:** abbilden (keine Plafonierung, getrennte Steuern) oder nur Ehepaare?
15. **Jährliche Pflege:** Wer aktualisiert `rules/<Jahr>.json` (Rentenanpassung 2027 ist beschlossen; BVG-Mindestzins 2027 und die amtliche Rententabelle 2027 sind noch OFFEN)?

---

## Anhang: Umgang mit OFFEN-Werten
- In `rules/2026.json` hat jeder Wert `status: "verifiziert" | "offen"`. Offene Werte werden nur als Default einer Nutzereingabe mit ⚠︎-Hinweis verwendet oder weggelassen.
- Aktuell OFFEN (Details in `quellen.md`):
  - BVG-Mindestzins 2027 (Empfehlung 1,75 %, Entscheid im November).
  - Amtliche Rententabelle Skala 44 für 2027 (im Rechner aus Art. 34 abgeleitet, Publikation fehlt).
  - Quellensteuer Bund auf Kapitalleistungen 2027 bis zur AS-Fassung.
  - Ob noch nicht bezogene PK-/FZ-/3a-Guthaben für die freiwillige AHV zum Vermögen zählen (Maximum 2026 inzwischen verifiziert: 25'250 bzw. 26'512.50 inkl. 5% VK).
  - Quellensteuersätze aller Kantone ausser SZ.
  - Offizielle LU-Quelle für den Vorsorgetarif.
  - Maschinenlesbare kantonale Tarife bzw. Nutzungsbedingungen des ESTV-Rechners.
  - Keine CH-Quellensteuer auf AHV-Renten im Ausland (abgeleitet).
  - Besteuerung von CH-Liegenschaften nach Wegzug.
  - Lizenzen Shiller/SNB/Pictet.
  - JST-Fortschreibung nach 2020.
