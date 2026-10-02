# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).
Regel: Jeder Pull Request erhöht die Version in `package.json` (Patch: 1.0.1, 1.0.2 …; grössere Änderungen: Minor: 1.1.0, 1.2.0 …), siehe [CONTRIBUTING](CONTRIBUTING.md).

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
