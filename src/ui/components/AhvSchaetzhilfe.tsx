import { useState } from 'react';
import { AHV_LINKS, ahvSchaetzung } from '../../core/ahvSchaetzung';
import type { AhvSchaetzhilfeEingabe, Person } from '../../core/typen';
import type { Regeln } from '../../rules';
import { fmtChf } from '../format';
import { BetragFeld, Schalter, Segmente, ZahlFeld } from './Felder';

interface Props {
  p: Person;
  /** andere Person im Haushalt (für das Splitting) */
  partner: Person | null;
  verheiratet: boolean;
  regeln: Regeln;
  set: (fn: (p: Person) => Person) => void;
}

/** Aufklappbare AHV-Schätzhilfe pro Person. Ergebnis mit einem Klick ins AHV-Feld übernehmen. */
export function AhvSchaetzhilfe({ p, partner, verheiratet, regeln, set }: Props) {
  const [offen, setOffen] = useState(false);
  const [uebernommen, setUebernommen] = useState(false);
  const e = p.ahvSchaetzhilfe;
  const setE = (fn: (x: AhvSchaetzhilfeEingabe) => AhvSchaetzhilfeEingabe) => {
    setUebernommen(false);
    set((x) => ({ ...x, ahvSchaetzhilfe: fn(x.ahvSchaetzhilfe) }));
  };
  const partnerEinkommen =
    e.einkommenEhepartner > 0 ? e.einkommenEhepartner : (partner?.ahvSchaetzhilfe.einkommen ?? 0);
  const res = ahvSchaetzung(
    {
      ...e,
      einkommenEhepartner: partnerEinkommen,
      geburtsjahr: p.geburtsjahr,
      geburtsmonat: p.geburtsmonat,
      geschlecht: p.geschlecht,
    },
    regeln,
  );

  return (
    <div className="schaetzhilfe">
      <button
        type="button"
        className="knopf knopf--sekundaer"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
      >
        {offen ? '▾' : '▸'} AHV-Schätzhilfe
      </button>
      {offen ? (
        <div className="unterkarte">
          <p className="warnung">
            <strong>Grobe Schätzung, keine verbindliche Auskunft.</strong> Verbindlich ist nur die individuelle
            Rentenvorausberechnung Ihrer Ausgleichskasse.
          </p>
          <div className="raster">
            <ZahlFeld
              label="Jahrgang"
              value={p.geburtsjahr}
              min={1920}
              max={2015}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => set((x) => ({ ...x, geburtsjahr: Math.round(v) }))}
            />
            <Segmente
              label="Geschlecht"
              value={p.geschlecht}
              optionen={[
                { value: 'w', label: 'Frau' },
                { value: 'm', label: 'Mann' },
              ]}
              onChange={(v) => set((x) => ({ ...x, geschlecht: v }))}
            />
          </div>
          <Segmente
            label="Beitragsdauer angeben als"
            value={e.beitragsModus}
            optionen={[
              { value: 'luecken', label: 'Fehlende Jahre' },
              { value: 'jahreCh', label: 'Jahre in der Schweiz' },
            ]}
            onChange={(v) => setE((x) => ({ ...x, beitragsModus: v }))}
          />
          {e.beitragsModus === 'luecken' ? (
            <ZahlFeld
              label="Fehlende Beitragsjahre (Lücken, ohne Auslandsjahre)"
              einheit="Jahre"
              value={e.luecken}
              min={0}
              max={50}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setE((x) => ({ ...x, luecken: Math.round(v) }))}
              hinweis="Jahre ohne AHV-Beiträge (z.B. Studium ohne Mindestbeitrag). Den Stand zeigt der IK-Auszug."
            />
          ) : (
            <ZahlFeld
              label="Beitragsjahre in der Schweiz bis zum Referenzalter"
              einheit="Jahre"
              value={e.jahreCh}
              min={0}
              max={50}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setE((x) => ({ ...x, jahreCh: Math.round(v) }))}
              hinweis={`Inklusive künftiger Jahre. Volle Beitragsdauer Ihres Jahrgangs: ${res.vollDauer} Jahre.`}
            />
          )}
          <BetragFeld
            label="Durchschnittliches AHV-Jahreseinkommen (heutige CHF)"
            value={e.einkommen}
            min={0}
            max={10_000_000}
            onChange={(v) => setE((x) => ({ ...x, einkommen: v }))}
            hinweis="Massgebendes Einkommen: Durchschnitt über alle Beitragsjahre (nicht nur der heutige Lohn)."
          />
          <div className="raster">
            <ZahlFeld
              label="Ehejahre (vor dem Referenzalter)"
              einheit="Jahre"
              value={e.ehejahre}
              min={0}
              max={50}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setE((x) => ({ ...x, ehejahre: Math.round(v) }))}
              hinweis="Für das Einkommenssplitting (50/50)."
            />
            {e.ehejahre > 0 ? (
              <BetragFeld
                label="Ø Einkommen Ehepartner/in in den Ehejahren"
                value={e.einkommenEhepartner}
                min={0}
                max={10_000_000}
                onChange={(v) => setE((x) => ({ ...x, einkommenEhepartner: v }))}
                hinweis={
                  verheiratet && partner
                    ? `Leer = Wert aus der Schätzhilfe von ${partner.name || 'Person 2'} (${fmtChf(partner.ahvSchaetzhilfe.einkommen)}).`
                    : undefined
                }
              />
            ) : null}
          </div>
          <ZahlFeld
            label="Jahre mit Erziehungsgutschriften (optional)"
            einheit="Jahre"
            value={e.erziehungsJahre}
            min={0}
            max={50}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => setE((x) => ({ ...x, erziehungsJahre: Math.round(v) }))}
            hinweis={`Jahre mit mindestens einem Kind unter 16 (die Zahl der Kinder spielt keine Rolle). Gutschrift ${fmtChf(
              regeln.ahv.erziehungsgutschriftFaktorMinimalrente * regeln.ahv.minimalrenteMonat * 12,
            )} pro Jahr, während der Ehe hälftig.`}
          />
          <Schalter
            label="Beitragsjahre im Ausland"
            checked={e.ausland}
            onChange={(v) => setE((x) => ({ ...x, ausland: v }))}
          />
          {e.ausland ? (
            <>
              <ZahlFeld
                label="Anzahl Jahre im Ausland"
                einheit="Jahre"
                value={e.auslandJahre}
                min={0}
                max={50}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setE((x) => ({ ...x, auslandJahre: Math.round(v) }))}
              />
              <p className="info">
                Auslandsjahre erhöhen die Schweizer AHV-Rente nicht. Eine ausländische Rente (z.B. über ein
                Sozialversicherungsabkommen) bitte unten unter «Ausländische Renten» separat erfassen.
              </p>
            </>
          ) : null}

          <div className="schaetzhilfe__ergebnis" aria-live="polite">
            <p>
              Beitragsjahre: <strong>{res.beitragsjahre}</strong> von {res.vollDauer} · mdJE (Tabellenwert):{' '}
              <strong>{fmtChf(res.mdjeTabelle)}</strong>
            </p>
            <p>
              Geschätzte AHV-Rente: <strong className="gross">{fmtChf(res.renteMonat)}</strong> pro Monat
              <br />
              <small>
                Heutige Franken, ohne 13. Rente (+1/12, wird in der Simulation addiert) und ohne Plafonierung für
                Ehepaare (150%, ebenfalls in der Simulation).
              </small>
            </p>
            {res.hinweise
              .filter((t) => !t.startsWith('Auslandsjahre'))
              .map((t) => (
                <p key={t} className="klein">
                  {t}
                </p>
              ))}
            <button
              type="button"
              className="knopf"
              disabled={res.beitragsjahre === 0}
              onClick={() => {
                set((x) => ({
                  ...x,
                  ahv: {
                    ...x.ahv,
                    modus: 'eingabe',
                    renteMonat: res.renteMonat,
                    mdje: res.mdjeTabelle,
                    beitragsjahre: res.beitragsjahreSkala44,
                  },
                }));
                setUebernommen(true);
              }}
            >
              Ins AHV-Feld übernehmen
            </button>
            {uebernommen ? <p className="info">Übernommen – das Feld bleibt frei editierbar.</p> : null}
          </div>
          <p className="klein">
            Offizielle Angaben:{' '}
            <a href={AHV_LINKS.escal} target="_blank" rel="noopener noreferrer">
              Online-Rentenschätzung ESCAL (ahv-iv.ch)
            </a>{' '}
            ·{' '}
            <a href={AHV_LINKS.rentenvorausberechnung} target="_blank" rel="noopener noreferrer">
              Individuelle Rentenvorausberechnung bestellen
            </a>{' '}
            (
            <a href={AHV_LINKS.formular318282} target="_blank" rel="noopener noreferrer">
              Formular 318.282
            </a>
            ,{' '}
            <a href={AHV_LINKS.merkblatt306} target="_blank" rel="noopener noreferrer">
              Merkblatt 3.06
            </a>
            ). Nicht abgebildet: exakte Rentenskalen, Jugendjahre, Aufwertungsfaktoren, Betreuungsgutschriften.
          </p>
        </div>
      ) : null}
    </div>
  );
}
