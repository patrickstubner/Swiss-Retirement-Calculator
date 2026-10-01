import { Component, type ErrorInfo, type ReactNode } from 'react';
import { browserSpeicher, entferneHash, loescheLokal } from './state';

/** Setzt den Browser-Speicher zurück und lädt die Seite neu (Notfall-Reset gegen Absturzschleifen, Audit S-02). */
export function notfallReset(speicher: Storage | null = browserSpeicher()): void {
  loescheLokal(speicher);
  try {
    entferneHash();
  } catch {
    // ohne History-API nichts zu tun
  }
  window.location.reload();
}

interface Props {
  children: ReactNode;
}

/**
 * Fängt Fehler beim Rendern ab. Statt eines weissen Bildschirms erscheint eine Meldung mit zwei Wegen:
 * neu laden (Daten bleiben) oder gespeicherte Daten löschen und neu starten. Die Meldung enthält bewusst
 * keine Fehlerdetails oder Eingaben (keine sensiblen Daten in Fehlermeldungen).
 */
export class FehlerGrenze extends Component<Props, { fehler: boolean }> {
  override state = { fehler: false };

  static getDerivedStateFromError() {
    return { fehler: true };
  }

  override componentDidCatch(_fehler: Error, _info: ErrorInfo) {
    // bewusst keine Protokollierung nach aussen: die App sendet nichts an Server
  }

  override render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <main className="fehlergrenze" role="alert">
        <h1>Ruhestandsrechner Schweiz</h1>
        <p>
          <strong>Es ist ein unerwarteter Fehler aufgetreten.</strong> Möglicherweise sind gespeicherte oder importierte
          Eingaben nicht verwendbar.
        </p>
        <div className="fehlergrenze__knoepfe">
          <button type="button" className="knopf" onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
          <button
            type="button"
            className="knopf knopf--gefahr"
            onClick={() => {
              if (window.confirm('Alle im Browser gespeicherten Eingaben löschen und neu starten?')) notfallReset();
            }}
          >
            Gespeicherte Daten löschen und neu starten
          </button>
        </div>
        <p className="klein">Die Daten liegen nur in diesem Browser; es wird nichts an einen Server gesendet.</p>
      </main>
    );
  }
}
