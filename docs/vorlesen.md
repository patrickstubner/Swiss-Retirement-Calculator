# Vorlesen (Sprachausgabe)

Stand: 30.9.2026 · Quelle: eigene Umsetzung (Web Speech API, MDN «SpeechSynthesis»); Code in `src/ui/vorlesen/`.

## Was es macht
- «Ganze Seite vorlesen», je Abschnitt «Vorlesen» und «ab hier» (bis zum Seitenende).
- Bedienleiste unten (nur während des Vorlesens): Pause/Weiter, Stopp, −10 s, +10 s, Tempo, Stimme. Esc beendet das Vorlesen.
- Hervorhebung des aktuellen Satzes (immer) und Worts (wo der Browser `boundary`-Ereignisse liefert) über die CSS Custom Highlight API; Rückfall ohne diese API: der umgebende Absatz erhält das Attribut `data-vorlesen-aktiv`. Es wird nie HTML erzeugt oder eingefügt.
- Mitscrollen nur, wenn der Satz ausserhalb des sichtbaren Bereichs (oder hinter den unteren Leisten) liegt; bei `prefers-reduced-motion` ohne Animation.

## Aufbau (reine Logik getrennt vom Browser, alles mit Unit-Tests)
| Datei | Aufgabe |
|---|---|
| `aufbereitung.ts` | Text für die Aussprache aufbereiten (CHF, AHV/BVG buchstabiert, %, Apostroph-Tausender, «3a», Jahreszahlen 1100–1999 als Wort, Datum, Abkürzungen mit Punkt) und Position im Sprechtext auf die Stelle im Anzeigetext zurückrechnen |
| `saetze.ts` | Satzteilung (kennt «z. B.», «Nr.», Dezimalzahlen, Ordnungszahlen); lange Sätze werden an Satzzeichen/Leerzeichen geteilt |
| `zeit.ts` | Sprechdauer schätzen (Zeichen pro Sekunde), an gemessenen Sätzen kalibrieren, Sprungziel für ±10 s |
| `automat.ts` | Zustandsautomat (leer, spielt, pause) |
| `stimmen.ts` | Stimmenwahl (nur deutsche, de-CH vor de-DE vor de-AT) |
| `plan.ts` | Textblöcke → Warteschlange der Sätze; «ab hier» |
| `dom.ts` | Vorlesbare Textblöcke aus dem Dokument sammeln (schliesst Formulare, Knöpfe, Tabellen, Grafiken, Verstecktes aus) |
| `controller.ts` | Steuerung von `speechSynthesis` mit Umgehungen für bekannte Browser-Fehler |
| `einstellungen.ts` | Tempo/Stimme (nur bei aktivem Speichern) |
| `hervorhebung.ts`, `Vorlesen.tsx` | Browseranbindung und Oberfläche |
| `fake.ts` | Fake-`speechSynthesis` und Fake-Uhr für Tests |

## Bekannte Eigenheiten und Umgehung
- **Chrome bricht lange Äusserungen ab (ca. 15 s):** es wird satzweise gesprochen (höchstens 120 Zeichen je Äusserung); ein Wächter-Timer geht weiter, falls das `end`-Ereignis ausbleibt.
- **Pause/Weiter unzuverlässig (Android/Chrome):** Pause = `cancel()`, Weiter = aktuellen Satz neu starten. Ereignisse abgebrochener Äusserungen werden über einen Zähler verworfen.
- **Stimmen laden asynchron:** auf `voiceschanged` hören; nach 1,5 s gilt die Liste als geladen (dann erscheint bei Bedarf der Hinweis).
- **iOS:** Start nur direkt aus einer Nutzergeste (die Knöpfe rufen `speak` synchron im Klick auf).
- **Referenz halten:** laufende Äusserungen werden im Controller gehalten (Chrome sammelt sie sonst ein und meldet kein `end`).
- **Keine Sprachausgabe / keine lokale deutsche Stimme:** Knöpfe ausgeblendet; bei fehlender Stimme steht ein Hinweis.

## Grenzen (ehrlich)
- **±10 Sekunden ist geschätzt.** Die API kennt weder Gesamtdauer noch Position in Sekunden. Geschätzt wird aus Zeichen pro Sekunde (Ausgangswert 14 bei Tempo 1, wird an gelesenen Sätzen gemessen und geglättet); gesprungen wird immer auf einen Satzanfang.
- **Wortmarkierung** gibt es nur, wenn der Browser `boundary`-Ereignisse mit Wortposition liefert (Chrome/Edge lokal meist ja, Safari/Firefox unterschiedlich). Sonst bleibt der Satz markiert.
- **Stimmen und Aussprache** hängen vom Gerät ab; Zahlen und Abkürzungen werden aufbereitet, Fachbegriffe können trotzdem holprig klingen.
- **Nur lokale Stimmen:** Online-Stimmen (`localService === false`) werden nicht angeboten, damit kein Text das Gerät verlässt. Manche Systeme haben nur Online-Stimmen: dann gibt es keine Vorlesefunktion.
- Die Seite ändert sich während des Vorlesens (z. B. Eingabe): die Hervorhebung wird dann unterdrückt, wenn die Textstelle nicht mehr existiert; neu starten.

## Datenschutz und Sicherheit
- Nur `speechSynthesis` des Browsers; kein Netzwerk, keine neuen Abhängigkeiten, CSP unverändert.
- Gelesen wird nie der Wert eines Formularfelds (`input`, `textarea`, `select`, `contenteditable` sind ausgeschlossen, ebenso Beschriftungen, Knöpfe, Tabellen, Grafiken, `hidden`, `aria-hidden`, `inert`, `data-vorlesen="aus"`).
- Gespeichert werden höchstens Tempo (aus fester Liste) und Stimmen-Kennung im `localStorage` unter `ruhestandsrechner:vorlesen`, nur bei aktivem Speichern; Ausschalten löscht den Schlüssel.
- Tests: `npx vitest run src/ui/vorlesen`; Browsertest mit gemocktem `speechSynthesis`: `node scripts/vorlesen-browsertest.mjs` (Preview muss laufen).
