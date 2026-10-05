# Umsetzungsplan grosse Funktionen (Vorschlag, Stand 2.10.2026)

Nichts davon ist gebaut. Aufwand in Personentagen (PT) grob, jeweils mit Tests und Quellenprüfung. «Belegbar» heisst: amtliche Quelle liegt vor oder ist klar benannt. Alle Werte, die nicht amtlich belegt werden, bleiben OFFEN (Regel in `docs/quellen.md`).

| Reihenfolge | Funktion | Aufwand | Abhängigkeiten |
|---|---|---|---|
| 1 | Regeljahr 2027 fertigstellen (sobald BSV/Bundesrat publizieren) | 0.5 PT | AHV-Anpassung, BVG-Grenzen, 3a-Maxima, Mindestzins: amtliche Publikation |
| 2 | Kirchensteuer in den übrigen 24 Kantonen | mittel, 3–5 PT | Steuerfüsse je Gemeinde als Datensatz |
| 3 | Auslandskrankenversicherung / KVG-Modell | mittel, 4–6 PT | Prämien, Prämienverbilligung je Kanton |
| 4 | Exit-Steuern / Wegzugsbesteuerung | gross, 6–10 PT | Länderauswahl, Rechtsprüfung je Land |
| 5 | Steuermodell Brasilien | gross, 10–15 PT | DBA CH–BR, IRPF-Tabellen, Rechtsprüfung |
| 6 | «Umherreisen mit CH-Wohnsitz» | mittel bis gross, 5–8 PT | Entscheid zum Steuerdomizil, Krankenversicherung |
| 7 | Teilvorbezug 20–80 % und AHV-Skalen 1–43 | mittel, 3–4 PT | Tabellen aus MB 3.04 / Art. 52 AHVV |

## 1. Regeljahr 2027 fertigstellen
- Stand 5.10.2026: Bundesratsentscheid vom 2.10.2026 (AHV/IV/EO, BVG-Grenzen, Säule 3a) ist in `src/rules/2027.json` (Abschnitt 21 in `docs/quellen.md`). DBG-Tarife und Kinderermässigung 264 bleiben der EFD-Vorabdruck.
- Weiter offen: BVG-Mindestzins (Bundesrat, voraussichtlich November), QStV-Satz 125–150k bis zur AS, kantonale Tarife, Gegenprobe der abgeleiteten Skala-44-Tabelle mit «Rententabellen 2027».
- Abnahme: Banner ab 1.1.2027 sagt «teilweise erfasst» und trennt Beschlossenes von den fortgeschriebenen Werten; Wächter `regeljahr.yml` bleibt grün. Der Zähler geht auf 0, wenn keine Hinweise «Fortgeschrieben» mehr übrig sind.

## 2. Kirchensteuer übrige Kantone (3–5 PT)
- Ist-Zustand: Nur ZH und AG mit Steuerfüssen je Gemeinde; sonst Referenzraster ohne Kirchensteuer.
- Daten: ESTV-Steuerrechner (Steuerfüsse je Gemeinde, bereits lokal vorhanden für 2'110 Gemeinden, siehe `docs/kantone.md`) als Build-Zeit-Datensatz; Nutzungsbedingungen der Schnittstelle sind OFFEN und vorher zu klären.
- Schritte: Konfession als Eingabe (ref./röm.-kath./christ-kath./keine), Datenformat `data/kirchensteuer-2026.json`, Berechnung als Zuschlag auf die einfache Staatssteuer (je Kanton unterschiedliche Basis; Kantone mit eigenem Kapitalleistungs-Kirchentarif wie UR gesondert), Anzeige als eigene Zeile im Steuerergebnis.
- Tests: Stichproben gegen den ESTV-Rechner je Kanton, Fälle ohne Konfession, Jahreswechsel.
- Risiko: Kirchensteuer juristischer Personen und Austritt sind nicht abgebildet.

## 3. Auslandskrankenversicherung / KVG-Modell (4–6 PT)
- Ist-Zustand: freier Posten in `src/data/defaults.ts` (Krankenkasse als Betrag).
- Umfang: Inland: Prämienregion, Franchise, Altersgruppe, Prämienverbilligung; Ausland: Wegfall der KVG-Pflicht bei Wegzug, private Auslandsversicherung als Eingabe mit Richtwerten.
- Quellen: BAG-Prämienrechner und Prämienstatistik, kantonale Prämienverbilligungs-Tabellen (je Kanton, sehr unterschiedlich).
- Empfehlung: zuerst nur Inlandsmodell mit BAG-Durchschnittsprämie je Kanton und Altersgruppe (Schritt 1, 2 PT), Prämienverbilligung nur als Hinweis; Ausland als Eingabe mit Warnung.
- Tests: Prämienstichproben, Franchise-Wirkung, Alter 65+.

## 4. Exit-Steuern / Wegzugsbesteuerung (6–10 PT)
- Ist-Zustand: Wegzug mit Kapitalbarauszahlung PK/3a ist umgesetzt (Quellensteuer Bund und Kantone). Eine Besteuerung stiller Reserven oder Wegzugssteuern des Ziellandes fehlt.
- Schweiz: kennt für Privatpersonen keine allgemeine Wegzugssteuer; Sonderfälle (Beteiligungen, Liegenschaften, Vorsorge) prüfen.
- Zielländer: je Land eigene Regeln (z. B. Deutschland, Frankreich, Spanien, Portugal, Brasilien), jeweils Rechtsprüfung mit amtlicher Quelle (Steuerbehörde des Landes, DBA-Text).
- Vorgehen: pro Land ein Modul hinter `data/laender-2026.json` mit klar gekennzeichneter Näherung; kein Land ohne amtliche Quelle freischalten, restliche Länder zeigen OFFEN.
- Empfehlung: nicht ohne steuerrechtliche Prüfung bauen.

## 5. Steuermodell Brasilien (10–15 PT)
- Grundlagen im Repo: `docs/auslandsszenarien.md`, Sozialversicherungsabkommen CH–BR (SR 0.831.109.198.1), INSS-Übersicht in `docs/quellen.md` Abschnitt 7.
- Fehlt: Einkommensteuer IRPF (Progressionstabelle, Abzüge, Rentenbesteuerung ausländischer Renten), Besteuerung von Kapitalerträgen und Wertschriften, DBA CH–BR bzw. Steuerabkommen (Anrechnung, Quellensteuer auf PK-Kapital, siehe `wegzugRueckforderungKapital`), Umrechnung BRL/CHF, Inflation BRL.
- Schritte: (1) Quellen sammeln (Receita Federal, DBA-Text, ESTV), 2 PT; (2) IRPF-Funktion mit Tarif und Abzügen, 3 PT; (3) Wechselkurs- und Inflationsmodell für BRL, 3 PT; (4) DBA-Anrechnung, 3 PT; (5) Oberfläche, Texte, Tests, 3 PT.
- Risiko: hoch (Rechtslage, Wechselkurs). Ohne Steuerberatung nur als Näherung mit Warnung.

## 6. Umherreisen mit CH-Wohnsitz (5–8 PT)
- Fachlich offen: Wohnsitz in der Schweiz behalten bei längeren Auslandsaufenthalten (Steuerdomizil, AHV-Versicherung, KVG-Pflicht, Wegzugsmeldung).
- Schritte: Entscheidungsbaum (Aufenthaltsdauer, Mittelpunkt der Lebensinteressen) mit Quellen von ESTV und Kantonen; Kosten je Szenario (Reisekosten, Auslandskrankenversicherung, fehlende Vergünstigungen); nur als Szenario-Vergleich, keine Steuerberatung.
- Abhängigkeit: Punkt 3 (Krankenversicherung).

## 7. Teilvorbezug und AHV-Skalen (3–4 PT)
- Ist-Zustand: `ahv.teilrenteSkala` ist offen (linear angenähert).
- Daten: Skalen 1–43 aus Art. 52 AHVV / MB 3.04, bei der Informationsstelle AHV/IV (ahv-iv.ch) und im BSV; vollständige amtliche Tabellen vor der Umsetzung beschaffen.
- Tests: Vergleich mit den Beispielen der Merkblätter, Plafonierung bei Teilrenten.
