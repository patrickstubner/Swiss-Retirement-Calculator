# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).
Regel: Jeder Pull Request erhöht die Version in `package.json` (Patch: 1.0.1, 1.0.2 …; grössere Änderungen: Minor: 1.1.0, 1.2.0 …), siehe [CONTRIBUTING](CONTRIBUTING.md).

## [1.3.0] - 2026-10-06

### Geändert
- Krisenmodus «Individuell»: geplante Krisen lassen sich hinzufügen, entfernen und bearbeiten. Pro Eintrag eine historische Krise aus dem Katalog (oder eine eigene Annahme mit Rückgang, Dauer und Erholung) und ein Startjahr im Planungshorizont. Das Alter am Jahresende wird als Hilfe angezeigt. Überschneidungen werden nicht doppelt gezählt (späterer Beginn gilt). Höchstens 8 Einträge. Die Bänder im Vermögensverlauf tragen den Namen der gewählten Krise.
- Kennzahlen der Katalogkrisen (realer Aktienrückgang, Dauer bis zum Tiefpunkt, Erholung, Teuerung) werden aus den bestehenden Reihen gerechnet (JST Macrohistory R6, Schweiz ab 2021 SNB und BFS). Eine eigene Krise ist eine Modellannahme, keine historische Zahl.
- Schema 13. Ein gespeicherter Stand ohne Krisenliste bleibt leer. Einträge ohne `eigen` sind Katalogkrisen.
- AHV-Vorbezug: Ein unzulässiger Vorbezug wird auf den höchsten zulässigen Wert gekürzt (Mann Jahrgang 1965: −36 Monate wird −24), statt auf den ordentlichen Bezug zurückzufallen. Gilt beim Laden, in der Simulation und beim Wechsel von Geschlecht oder Jahrgang. Frauen der Übergangsgeneration behalten einen zulässigen Vorbezug von −36 Monaten.
- AHV-Bezug: Der doppelte Hinweis am Zahlenfeld der Monate entfällt. Die Beschriftung der Entnahme-Töpfe ist auf 40 Zeichen begrenzt.

## [1.2.2] - 2026-10-06

### Geändert
- AHV-Vorbezug: Die Speichergrenze folgt der weitesten gesetzlichen Spanne (höchstes Referenzalter minus frühestes Übergangsalter, derzeit 36 Monate). Ein zulässiger Vorbezug bleibt beim Laden aus Link, Datei und lokalem Speicher erhalten.
- AHV-Bezug: Hinweis «Bei Geburt am 1. eines Monats beginnt die Rente einen Monat früher.» Liegt ein Rentenbeginn in der Vergangenheit, steht das bei der Variante. Der gewählte Satz erscheint nur noch in der Liste.

## [1.2.1] - 2026-10-05

### Geändert
- AHV-Bezug: Bei Referenzalter, Vorbezug und Aufschub stehen Rentenbeginn (1. des Folgemonats) und das Alter in diesem Monat, nicht nur die Monate früher oder später. Beim Referenzalter zusätzlich das gesetzliche Alter in Jahren und Monaten (Übergang AHV 21).
- Säule 3a: Die Rechnung und die Eingabegrenze bleiben beim geladenen Regeljahr (2026: mit PK 7'258, ohne PK 36'288). Der Hinweis nennt zusätzlich das gesetzliche Maximum ab 2027 (mit PK 7'373, ohne PK 36'864).

## [1.2.0] - 2026-10-05

### Geändert
- Standard-Entnahmestrategie ist «Dynamisch gestaffelt (nach Depotwachstum)». Der Satz für das nächste Jahr hängt vom realen Depotwachstum des Vorjahres ab (Rendite des freien Finanzvermögens, ohne Kapitalbezüge; Teiljahre auf ein Jahr hochgerechnet). Stufen, editierbar: ab 14 % → 6 %, ab 7 % → 5 %, ab 2 % → 4 %, unter 2 % → 3,5 %. Der Standard geht nicht unter 3,5 %, auch nicht bei Verlusten unter −4 %. Eine optionale tiefere Stufe (unter −4 % → 3 %, genau −4 % bleibt 3,5 %) lässt sich ergänzen. Im ersten Simulationsjahr gibt es kein Vorjahr; gerechnet wird mit 0 % (3,5 %).
- Weitere Strategien bleiben wählbar: Statisch (inflationsangepasst, über die erfassten Ausgaben oder über einen Anfangssatz), Dynamisch (fester Prozentsatz, Standard 4 %), Annuität / Vermögensrente, Mehr-Töpfe. Schwellen, Sätze und Topf-Angaben sind editierbar.
- Mehr-Töpfe: Der Puffer heisst «Cash / Geldmarkt» (Konto, Geldmarkt, sehr kurze Papiere; reale Rendite Standard 0,5 %). Mittel- bis langfristige Obligationen liegen im mittleren Topf, nicht im Puffer. Zu Beginn der Entnahmephase deckt der Puffer etwa ein Jahr des Nettobedarfs und wächst über vier Jahre auf etwa zwei Jahre. Ausgaben kommen zuerst aus dem Puffer. Einmal jährlich wird er aus den Risikotöpfen aufgefüllt, aber nicht aus einem Topf, dessen reale Jahresrendite unter −10 % liegt. Reicht der Puffer nicht, werden die Risikotöpfe für die Ausgaben trotzdem angetastet.
- Schema 12. Fehlt das Feld `entnahme` in einem gespeicherten Stand oder Link, gilt die gestaffelte Strategie. Das ändert die Rechnung gegenüber dem bisherigen Lückenmodell. «Statisch (Ausgaben)» stellt das bisherige Verhalten wieder her. Die Umkehrrechnung bleibt bei «Statisch (Ausgaben)».
- Bei den Satz-Strategien senken AHV, Pensionskasse und weitere Einnahmen den Entnahmesatz nicht; sie kommen zur Entnahme hinzu. Bei «Statisch (Ausgaben)» und «Mehr-Töpfe» senken sie die Lücke wie bisher.

## [1.1.1] - 2026-10-05

### Geändert
- Beschriftungen nennen das Jahr der geladenen Regeln (`regeln.meta.jahr`) statt fest «2026»: Maximum Säule 3a, «gesetzliche Werte», Disclaimer «Stand».
- Screenshot `screenshots/134-banner-regeljahr-teilweise-360.png` zeigt den Bannertext nach dem Bundesratsentscheid.
- Beispielperson B in zwei Tests: Jahrgang 1985.
- Vorbezugs- und Aufschubsätze 2027: Status offen. Die Sätze für die Rechnung bleiben 6,8 % / 13,6 % bzw. 5,2–31,5 %, solange der Widerspruch zwischen BSV AHV 21 und den Berechnungsvorschriften 2027 nicht geklärt ist.

## [1.1.0] - 2026-10-05

### Geändert
- Regeljahr 2027: AHV/IV/EO, BVG-Grenzbeträge und Säule 3a nach dem Bundesratsentscheid vom 2.10.2026 (Minimalrente 1'280, Maximalrente 2'560, Mindestbeitrag 541, freiwillige AHV/IV 1'030, BVG-Eintrittsschwelle 23'040, Säule 3a 7'373 / 36'864). Quellen in `docs/quellen.md`, Abschnitt 21.
- Vorbezugs- und Aufschubsätze 2027 unverändert gegenüber 2026; Einkommensgrenzen der Übergangsgeneration 61'440 und 76'800.
- Banner ab 1.1.2027: was berücksichtigt ist und was offen bleibt.

### Offen
- BVG-Mindestzins 2027 (Empfehlung 1,75 %, Entscheid im November).
- Quellensteuer des Bundes auf Kapitalleistungen 2027 bis zur Veröffentlichung in der Amtlichen Sammlung.
- Kantonale Tarife 2027 und die publizierte Rententabelle Skala 44 (im Rechner aus der Rentenformel abgeleitet).

## [1.0.0] - 2026-10-02

Erste stabile Version des Ruhestandsrechners Schweiz.

### Funktionen
- Simulation von AHV, Pensionskasse, Säule 3a, ausländischen Renten, freiem Vermögen, Ausgaben und Steuern; Suche des frühesten Rücktrittsalters.
- Standardannahmen 7 % Rendite nominal und 2 % Teuerung mit Einordnung nach Aktienanteil und Quellen (`docs/quellen.md`, Abschnitt 20).
- Monte Carlo im Web Worker mit Fortschritt, Abbruch und Rückfall im Hauptthread.
- Regeljahr 2027 in Vorbereitung: DBG-Tarife und Kinderermässigung amtlich, übrige Werte offen und fortgeschrieben.
- Barrierefreiheit: Tastaturzugang zu scrollbaren Tabellen, Kontrast, Landmarks, Mindestgrösse der Bedienelemente.
- Erklärung, wenn «reicht nicht» trotz positivem Endvermögen angezeigt wird.

### Sicherheit und Qualität
- Core-Eingänge sind gegen NaN und Infinity geschützt; die Simulation weist ungültige Zahlen mit klarer Meldung ab.
- E-Mail-Guard (Dateien und Commit-Metadaten), Datenschutz-Guard, Geheimnis-Scan und `npm audit` in der CI.
- Versionsregel in der CI: Die Version in `package.json` muss in jedem Pull Request erhöht werden (Dependabot ausgenommen).
