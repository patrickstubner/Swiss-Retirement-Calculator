import { useState } from 'react';
import { Schalter, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtProzent } from '../format';
import type { SchrittProps } from '../kontext';

interface Props extends SchrittProps {
  speichern: boolean;
  onSpeichern: (v: boolean) => void;
  onZuruecksetzen: () => void;
}

export function Annahmen({ h, setH, regeln, speichern, onSpeichern, onZuruecksetzen }: Props) {
  const a = h.annahmen;
  const setA = (patch: Partial<typeof a>) => setH((x) => ({ ...x, annahmen: { ...x.annahmen, ...patch } }));
  const [kopiert, setKopiert] = useState(false);
  const real = (1 + a.renditeNominal - a.kosten) / (1 + a.inflation) - 1;

  return (
    <>
      <Karte titel="Rendite und Teuerung" untertitel="Deterministisch (konstant). Historische Szenarien folgen.">
        <div className="raster">
          <ZahlFeld
            label="Rendite freies Vermögen (nominal)"
            prozent
            value={a.renditeNominal}
            min={-0.2}
            max={0.3}
            onChange={(v) => setA({ renditeNominal: v })}
          />
          <ZahlFeld
            label="Anlagekosten (TER)"
            prozent
            value={a.kosten}
            min={0}
            max={0.05}
            onChange={(v) => setA({ kosten: v })}
          />
        </div>
        <ZahlFeld
          label="Teuerung (Inflation)"
          prozent
          value={a.inflation}
          min={-0.05}
          max={0.2}
          onChange={(v) => setA({ inflation: v })}
        />
        <p className="info">
          Reale Nettorendite: <strong>{fmtProzent(real, 2)}</strong> pro Jahr
        </p>
        <ZahlFeld
          label="AHV-Anpassung über der Teuerung"
          prozent
          value={a.ahvAnpassungReal}
          min={-0.05}
          max={0.05}
          onChange={(v) => setA({ ahvAnpassungReal: v })}
          hinweis="0% = Renten folgen der Teuerung (Mischindex). Die Rentenanpassung 2027 ist noch offen."
        />
        <ZahlFeld
          label="Steuerbarer Vermögensertrag"
          prozent
          value={a.steuerbarerErtrag}
          min={0}
          max={0.2}
          onChange={(v) => setA({ steuerbarerErtrag: v })}
          hinweis="Zinsen und Dividenden in % des freien Vermögens (Kapitalgewinne sind steuerfrei)."
        />
        <ZahlFeld
          label="Verwaltungskosten auf AHV-Beiträgen Nichterwerbstätiger"
          prozent
          value={a.neVerwaltungskosten}
          min={0}
          max={regeln.beitraege.nichterwerbstaetige.verwaltungskostenMax}
          onChange={(v) => setA({ neVerwaltungskosten: v })}
          hinweis="Je nach Ausgleichskasse, höchstens 5%."
        />
      </Karte>
      <Karte titel="Speichern und Teilen">
        <p className="klein">
          Ihre Eingaben stehen im Link dieser Seite (nach dem #). Dieser Teil wird nicht an einen Server gesendet. Wer
          den Link erhält, sieht alle Ihre Zahlen.
        </p>
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href).then(() => setKopiert(true));
          }}
        >
          {kopiert ? 'Link kopiert' : 'Link kopieren'}
        </button>
        <Schalter
          label="Eingaben auf diesem Gerät speichern"
          hinweis="Optional (localStorage). Beim Ausschalten werden die gespeicherten Daten gelöscht."
          checked={speichern}
          onChange={onSpeichern}
        />
        <button type="button" className="knopf knopf--gefahr" onClick={onZuruecksetzen}>
          Alle Eingaben zurücksetzen
        </button>
      </Karte>
    </>
  );
}
