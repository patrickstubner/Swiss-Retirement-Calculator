# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).
Regel: Jeder Pull Request erhöht die Version in `package.json` (Patch: 1.0.1, 1.0.2 …; grössere Änderungen: Minor: 1.1.0, 1.2.0 …), siehe [CONTRIBUTING](CONTRIBUTING.md).

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
