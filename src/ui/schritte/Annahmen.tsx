import { useId, useState } from 'react';
import { ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtProzent } from '../format';
import type { SchrittProps } from '../kontext';
import { teilenLink } from '../state';
import { VEREINFACHUNG_BOERSE, VEREINFACHUNG_WOHNEIGENTUM } from '../texte';

interface Props extends SchrittProps {
  onZuruecksetzen: () => void;
}

export function Annahmen({ h, setH, regeln, onZuruecksetzen }: Props) {
  const a = h.annahmen;
  const setA = (patch: Partial<typeof a>) => setH((x) => ({ ...x, annahmen: { ...x.annahmen, ...patch } }));
  const [kopiert, setKopiert] = useState(false);
  const [link, setLink] = useState('');
  const linkId = useId();
  const real = (1 + a.renditeNominal - a.kosten) / (1 + a.inflation) - 1;

  return (
    <>
      <Karte titel="Rendite und Teuerung" untertitel="Deterministisch (konstant). Historische Szenarien folgen.">
        <div className="raster">
          <ZahlFeld
            label="Rendite Börse (nominal)"
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
          label="Zins Bargeld / Konten (nominal)"
          prozent
          value={a.renditeBargeld}
          min={-0.05}
          max={0.2}
          onChange={(v) => setA({ renditeBargeld: v })}
        />
        <ZahlFeld
          label="Teuerung (Inflation)"
          prozent
          value={a.inflation}
          min={-0.05}
          max={0.2}
          onChange={(v) => setA({ inflation: v })}
        />
        <p className="info">
          {VEREINFACHUNG_BOERSE} {VEREINFACHUNG_WOHNEIGENTUM}
        </p>
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
          hinweis="Zinsen und Dividenden in % des Anlagevermögens (Kapitalgewinne sind steuerfrei)."
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
      <Karte titel="Teilen und Zurücksetzen">
        <p className="klein">
          «Link erstellen» packt alle Eingaben in einen Link (nach dem #). Dieser Teil wird nicht an einen Server
          gesendet. Wer den Link erhält, sieht alle Ihre Zahlen. Ein geöffneter Link hat Vorrang vor den im Browser
          gespeicherten Eingaben.
        </p>
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => {
            const l = teilenLink(h, window.location.href);
            setLink(l);
            setKopiert(false);
            void navigator.clipboard
              ?.writeText(l)
              .then(() => setKopiert(true))
              .catch(() => setKopiert(false));
          }}
        >
          {kopiert ? 'Link kopiert' : 'Link erstellen und kopieren'}
        </button>
        {link ? (
          <div className="feld">
            <label htmlFor={linkId}>Link zum Teilen</label>
            <input id={linkId} type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
        <button type="button" className="knopf knopf--gefahr" onClick={onZuruecksetzen}>
          Alle Eingaben zurücksetzen
        </button>
      </Karte>
    </>
  );
}
