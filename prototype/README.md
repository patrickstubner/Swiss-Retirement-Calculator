# Redesign-Vorschlag (Prototyp)

Klickbarer UX-Vorschlag für den Schweizer Ruhestandsrechner. Kein Ersatz für die App, kein echter Rechenkern, keine Beratung.

- Nur statisches HTML, CSS und JavaScript. Kein Build, keine Abhängigkeiten, kein Netz, kein Speichern.
- Start mit einem **Beispielhaushalt** (Jahrgang 1976, Kanton Zürich). Zuerst nur Eckdaten, der Rest sind sichtbare Standardwerte. Das Ergebnis ist eine grobe Schätzung und lässt sich freiwillig verfeinern, bis ins Detail. Wohneigentum und Wegzug sind optionale Module. Der Planungshorizont bleibt 120.
- Es gibt keinen Schalter «Schnell / Detailliert».
- Branch im App-Repo: `prototype/redesign`. **Nicht nach main mergen**, die Production-Pages der App nicht umstellen.

## Vorschau

Kostenlos auf einem eigenen GitHub-Pages-Repo, getrennt von der produktiven App:

- https://patrickstubner.github.io/Ruhestandsrechner-Prototyp/

Lokal: `python3 -m http.server` in diesem Ordner.

## Sicherheitsprüfung 22.11.2026

Stand: Dateien in `prototype/`. Keine Geheimnisse, keine Fremdskripte, keine Cookies, kein `localStorage`. CSP über Meta-Tag (`default-src 'none'`, `script-src`/`style-src`/`img-src 'self'`). Eingaben werden nur als Zahlen gelesen und mit `textContent` angezeigt. Ergebnis: keine Schwachstellen im Prototyp.
