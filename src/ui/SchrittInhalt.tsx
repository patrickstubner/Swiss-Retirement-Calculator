import type { SchrittProps } from './kontext';
import { Annahmen } from './schritte/Annahmen';
import { EinkommenVorsorge } from './schritte/EinkommenVorsorge';
import { Ergebnis, type SuchModus } from './schritte/Ergebnis';
import { Personen } from './schritte/Personen';
import { SchnellEingaben } from './schritte/SchnellEingaben';
import { VermoegenAusgaben } from './schritte/VermoegenAusgaben';

interface Props {
  props: SchrittProps;
  schnell: boolean;
  /** Index des aktiven Schritts, `ergebnisSchritt` = letzter */
  schritt: number;
  ergebnisSchritt: number;
  suchModus: SuchModus;
  setSuchModus: (m: SuchModus) => void;
  zuDetail: () => void;
  onZuruecksetzen: () => void;
  /** Versionen A/B sind an: die Darstellung hat oben im Vergleich schon einen Umschalter. */
  vergleich?: boolean;
}

/** Inhalt des aktiven Schritts für EINE Version (die Hauptversion oder eine Spalte im Vergleich). */
export function SchrittInhalt({
  props,
  schnell,
  schritt,
  ergebnisSchritt,
  suchModus,
  setSuchModus,
  zuDetail,
  onZuruecksetzen,
  vergleich = false,
}: Props) {
  return (
    <>
      {schnell && schritt === 0 ? <SchnellEingaben {...props} /> : null}
      {!schnell && schritt === 0 ? <Personen {...props} /> : null}
      {!schnell && schritt === 1 ? <EinkommenVorsorge {...props} /> : null}
      {!schnell && schritt === 2 ? <VermoegenAusgaben {...props} /> : null}
      {!schnell && schritt === 3 ? <Annahmen {...props} onZuruecksetzen={onZuruecksetzen} /> : null}
      {schritt === ergebnisSchritt ? (
        <Ergebnis
          {...props}
          suchModus={suchModus}
          setSuchModus={setSuchModus}
          zuDetail={zuDetail}
          vergleich={vergleich}
        />
      ) : null}
    </>
  );
}
