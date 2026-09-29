/**
 * Verwaltung der Versionen A/B: B anlegen (Kopie von A), umbenennen, tauschen, kopieren, löschen sowie
 * Export/Import als JSON-Datei. Alle Daten bleiben im Browser (Speichern nur mit dem Schalter ganz oben).
 */
import { useId, useRef, useState } from 'react';
import { MAX_NAME } from '../state';
import type { VersionId, VersionsNamen } from '../szenarien';
import { MAX_IMPORT_BYTES } from '../validierung';
import { anzeigeName, VersionsMarke } from './Vergleich';

interface Props {
  namen: VersionsNamen;
  onNamen: (n: VersionsNamen) => void;
  onTauschen: () => void;
  /** Quelle über das Ziel kopieren */
  onKopieren: (von: VersionId) => void;
  /** Version löschen; die andere bleibt als einzige Version */
  onLoeschen: (welche: VersionId) => void;
  onExport: () => void;
  onImport: (text: string) => boolean;
  speichern: boolean;
}

export function VersionenLeiste({
  namen,
  onNamen,
  onTauschen,
  onKopieren,
  onLoeschen,
  onExport,
  onImport,
  speichern,
}: Props) {
  const idA = useId();
  const idB = useId();
  const datei = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const kopieren = (von: VersionId) => {
    const ziel = von === 'A' ? 'B' : 'A';
    const zielName = anzeigeName(ziel === 'A' ? namen.a : namen.b, ziel);
    if (window.confirm(`Alle Eingaben von ${zielName} durch eine Kopie von Version ${von} ersetzen?`)) onKopieren(von);
  };
  const loeschen = (welche: VersionId) => {
    const n = anzeigeName(welche === 'A' ? namen.a : namen.b, welche);
    const bleibt = welche === 'A' ? 'B' : 'A';
    if (window.confirm(`${n} löschen? Version ${bleibt} bleibt als einzige Version erhalten.`)) onLoeschen(welche);
  };

  return (
    <section className="karte versionen-leiste" aria-label="Versionen verwalten">
      <h2>Versionen A und B</h2>
      <p className="karte__untertitel">
        Beide Versionen haben dieselben Eingaben. Ändern Sie in einer Spalte etwas, ändert sich nur diese Version.
      </p>
      <div className="versionen-namen">
        <div className="feld">
          <label htmlFor={idA}>
            <VersionsMarke id="A" /> Name Version A
          </label>
          <input
            id={idA}
            type="text"
            maxLength={MAX_NAME}
            value={namen.a}
            placeholder="Version A"
            onChange={(e) => onNamen({ ...namen, a: e.target.value })}
          />
        </div>
        <div className="feld">
          <label htmlFor={idB}>
            <VersionsMarke id="B" /> Name Version B
          </label>
          <input
            id={idB}
            type="text"
            maxLength={MAX_NAME}
            value={namen.b}
            placeholder="Version B"
            onChange={(e) => onNamen({ ...namen, b: e.target.value })}
          />
        </div>
      </div>
      <div className="knopf-reihe versionen-knoepfe">
        <button type="button" className="knopf knopf--sekundaer" onClick={onTauschen}>
          A und B tauschen
        </button>
        <button type="button" className="knopf knopf--sekundaer" onClick={() => kopieren('A')}>
          A nach B kopieren
        </button>
        <button type="button" className="knopf knopf--sekundaer" onClick={() => kopieren('B')}>
          B nach A kopieren
        </button>
        <button type="button" className="knopf knopf--sekundaer" onClick={onExport}>
          Exportieren (Datei)
        </button>
        <button type="button" className="knopf knopf--sekundaer" onClick={() => datei.current?.click()}>
          Importieren (Datei)
        </button>
        <input
          ref={datei}
          type="file"
          accept="application/json,.json"
          className="nur-sr"
          aria-label="Exportdatei mit Version A und B auswählen"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > MAX_IMPORT_BYTES) {
              setMeldung('Die Datei ist zu gross (höchstens 1 MB).');
              return;
            }
            if (!window.confirm('Version A und B durch den Inhalt der Datei ersetzen?')) return;
            const ok = onImport(await f.text());
            setMeldung(ok ? 'Datei importiert.' : 'Die Datei ist keine gültige Exportdatei dieses Rechners.');
          }}
        />
        <button type="button" className="knopf knopf--gefahr" onClick={() => loeschen('B')}>
          B löschen
        </button>
        <button type="button" className="knopf knopf--gefahr" onClick={() => loeschen('A')}>
          A löschen
        </button>
      </div>
      {meldung ? (
        <p className="klein" role="status">
          {meldung}
        </p>
      ) : null}
      <p className="klein">
        {speichern
          ? 'Beide Versionen werden mit Ihren übrigen Eingaben im Browser gespeichert (Schalter ganz oben). Ohne Speichern gehen sie beim Schliessen der Seite verloren.'
          : 'Speichern ist aus: Beide Versionen gehen beim Schliessen der Seite verloren. Mit «Exportieren» sichern Sie sie in einer Datei auf Ihrem Gerät.'}
      </p>
    </section>
  );
}
