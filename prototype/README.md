# Redesign-Vorschlag (Prototyp)

Klickbarer UX-Vorschlag für den Schweizer Ruhestandsrechner. Kein Ersatz für die App, kein echter Rechenkern, keine Beratung.

- Nur statisches HTML, CSS und JavaScript. Kein Build, keine Abhängigkeiten, kein Netz, kein Speichern.
- Startet mit einem **Beispielhaushalt** (Jahrgang 1976, Kanton Zürich). Alle Zahlen sind frei änderbar.
- Branch: `prototype/redesign`. **Nicht nach main mergen**, keine Production-Pages umstellen.

## Vorschau

Vorschau (eine Datei, ohne Build, kostenlos):

- https://htmlpreview.github.io/?https://github.com/patrickstubner/Swiss-Retirement-Calculator/blob/prototype/redesign/prototype/standalone.html

`index.html` mit getrennten CSS/JS-Dateien eignet sich für einen lokalen Server. raw.githack war von hier aus nicht erreichbar, jsDelivr liefert HTML als `text/plain` und eignet sich deshalb nicht als direkter Link.

Lokal: Dateien in diesem Ordner mit einem beliebigen statischen Server öffnen, z. B. `python3 -m http.server`.

## Sicherheitsprüfung 22.11.2026

Stand: Dateien in `prototype/`. Keine Geheimnisse, keine Fremdskripte, keine Cookies, kein `localStorage`. CSP über Meta-Tag (`default-src 'none'`, `script-src`/`style-src`/`img-src 'self'`). Eingaben werden nur als Zahlen gelesen und mit `textContent` angezeigt. Ergebnis: keine Schwachstellen im Prototyp. Offenes Residualrisiko wie bei GitHub Pages: der gemeinsame `github.io`-Origin betrifft diese Vorschau-URLs nicht, weil sie auf anderen Hosts liegen.

## Absicht

Geführter Weg mit wenigen Feldern pro Schritt, eine Kernzahl im Ergebnis, eine einfache Grafik und optionale Vertiefung («Was wäre wenn?»). Farben und Logo entsprechen der genehmigten Strand-/Sunset-Gestaltung.
