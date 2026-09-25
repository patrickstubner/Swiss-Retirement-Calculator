/** Gemeinsame Personenfelder für die Modi «Schnell» und «Detailliert». */
import { ahvLueckenZuzug } from '../../core/schaetzwerte';
import type { Monat, Person, ZeitpunktModus } from '../../core/typen';
import { letzterArbeitsmonat, stoppAlterMonate } from '../../core/zeitpunkt';
import type { Regeln } from '../../rules';
import { fmtAlter, fmtMonat, MONATSNAMEN } from '../format';
import { alterMonate } from '../kontext';
import { AuswahlFeld, Segmente, ZahlFeld } from './Felder';

const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));
const STOPP_MONATE = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i} Mt.` }));
const MODI = [
  { value: 'alter', label: 'Alter' },
  { value: 'datum', label: 'Datum' },
] as const;

interface Props {
  p: Person;
  set: (fn: (p: Person) => Person) => void;
  heute: Monat;
}

export function GeburtFelder({ p, set, heute }: Props) {
  return (
    <>
      <Segmente
        label="Geschlecht"
        value={p.geschlecht}
        optionen={[
          { value: 'w', label: 'Frau' },
          { value: 'm', label: 'Mann' },
        ]}
        onChange={(g) => set((x) => ({ ...x, geschlecht: g }))}
      />
      <div className="raster">
        <ZahlFeld
          label="Geburtsjahr"
          value={p.geburtsjahr}
          min={1920}
          max={heute.jahr}
          nachkomma={0}
          gruppieren={false}
          onChange={(v) => set((x) => ({ ...x, geburtsjahr: Math.round(v) }))}
        />
        <AuswahlFeld
          label="Geburtsmonat"
          value={p.geburtsmonat}
          optionen={MONATE}
          onChange={(v) => set((x) => ({ ...x, geburtsmonat: v }))}
        />
      </div>
    </>
  );
}

/** «In der Schweiz seit» (optional): wichtig für AHV-Lücken bei Zuzug nach dem 20. Altersjahr. */
export function InChSeitFeld({ p, set, heute, regeln }: Props & { regeln: Regeln }) {
  const luecken = ahvLueckenZuzug(p, regeln);
  return (
    <ZahlFeld
      label="In der Schweiz seit (Jahr, optional)"
      value={p.inChSeit}
      min={0}
      max={heute.jahr}
      nachkomma={0}
      onChange={(v) => set((x) => ({ ...x, inChSeit: v > 0 ? Math.round(v) : 0 }))}
      hinweis={
        luecken > 0
          ? `Zuzug nach dem Beitragsbeginn: ca. ${luecken} fehlende AHV-Beitragsjahre (Rente ca. −${Math.round((luecken / regeln.ahv.vollrenteBeitragsjahre) * 100)}%). Frühere Auslandsjahre separat als ausländische Rente erfassen.`
          : 'Leer lassen, wenn Sie seit Ihrer Kindheit bzw. seit vor dem 21. Altersjahr in der Schweiz wohnen. Ein späterer Zuzug bedeutet AHV-Beitragslücken.'
      }
      warnung={p.inChSeit > 0 && p.inChSeit < p.geburtsjahr ? 'Das Jahr liegt vor der Geburt.' : null}
    />
  );
}

export function ErwerbsaufgabeFelder({ p, set, heute }: Props) {
  const stoppJ = Math.floor(p.stoppAlter + 1e-9);
  const stoppM = Math.round((p.stoppAlter - stoppJ) * 12);
  const heuteM = alterMonate(p, heute);
  const stoppMonate = stoppAlterMonate(p);
  const letzter = letzterArbeitsmonat(p, stoppMonate);
  const setStoppModus = (m: ZeitpunktModus) =>
    set((x) => {
      const monate = stoppAlterMonate(x);
      // Werte gegenseitig übernehmen, damit der Zeitpunkt beim Umschalten gleich bleibt
      return m === 'datum'
        ? { ...x, stoppModus: m, stoppDatum: letzterArbeitsmonat(x, monate) }
        : { ...x, stoppModus: m, stoppAlter: monate / 12 };
    });
  const setStoppDatum = (d: Partial<Monat>) => set((x) => ({ ...x, stoppDatum: { ...x.stoppDatum, ...d } }));
  return (
    <>
      <Segmente
        label="Erwerbsaufgabe (Wunsch) angeben als"
        value={p.stoppModus}
        optionen={MODI}
        onChange={setStoppModus}
      />
      {p.stoppModus === 'alter' ? (
        <div className="raster">
          <ZahlFeld
            label="Erwerbsaufgabe (Wunsch) mit"
            einheit="Jahren"
            value={stoppJ}
            min={0}
            max={80}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => set((x) => ({ ...x, stoppAlter: Math.round(v) + stoppM / 12 }))}
          />
          <AuswahlFeld
            label="und"
            value={stoppM}
            optionen={STOPP_MONATE}
            onChange={(v) => set((x) => ({ ...x, stoppAlter: stoppJ + v / 12 }))}
          />
        </div>
      ) : (
        <div className="raster">
          <AuswahlFeld
            label="Erwerbsaufgabe per Ende (Monat)"
            value={p.stoppDatum.monat}
            optionen={MONATE}
            onChange={(v) => setStoppDatum({ monat: v })}
          />
          <ZahlFeld
            label="Jahr"
            value={p.stoppDatum.jahr}
            min={p.geburtsjahr}
            max={p.geburtsjahr + 80}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => setStoppDatum({ jahr: Math.round(v) })}
          />
        </div>
      )}
      <p className="info" aria-live="polite">
        {p.stoppModus === 'datum' ? (
          <>
            Letzter Arbeitsmonat <strong>{fmtMonat(letzter)}</strong> → Alter bei Erwerbsaufgabe{' '}
            <strong>{fmtAlter(stoppMonate)}</strong>.
          </>
        ) : (
          <>
            Letzter Arbeitsmonat <strong>{fmtMonat(letzter)}</strong>.
          </>
        )}
        {stoppMonate < heuteM ? ' Dieser Zeitpunkt liegt in der Vergangenheit: gerechnet wird ab heute ohne Lohn.' : ''}
      </p>
    </>
  );
}
