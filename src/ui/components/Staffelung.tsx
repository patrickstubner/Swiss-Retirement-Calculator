/**
 * Karte «Kapitalbezüge staffeln und Steuer-Tipps»: Vergleich «ein Bezug» gegen Bezug in 2 … 5 Jahren (Steuer auf
 * Kapitalleistungen, Endvermögen), Schalter für den Plan (Schema 11) und Steuer-Tipps, die zum Fall passen.
 */
import { useMemo } from 'react';
import { inDarstellung } from '../../core/nominal';
import { type StaffelVariante, staffelVarianten } from '../../core/staffelung';
import type { Haushalt, Monat, Staffelung } from '../../core/typen';
import { neueStaffelung } from '../../data/defaults';
import type { Regeln } from '../../rules';
import { chfKurz, darstellungVon, endBetrag, inFranken } from '../darstellung';
import { fmtChf } from '../format';
import type { Setzer } from '../kontext';
import { STAFFEL_QUELLEN, steuerTipps } from '../steuerTipps';
import { Schalter, ZahlFeld } from './Felder';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

const JAHRE_LISTE = [1, 2, 3, 4, 5] as const;

interface Props {
  h: Haushalt;
  setH: Setzer;
  /** Haushalt mit Schätzwerten */
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  namen: string[];
}

export function StaffelungKarte({ h, setH, effH, regeln, heute, namen }: Props) {
  const st: Staffelung = h.staffelung ?? neueStaffelung();
  const dar = darstellungVon(h);
  const set = (patch: Partial<Staffelung>) =>
    setH((x) => ({ ...x, staffelung: { ...(x.staffelung ?? neueStaffelung()), ...patch } }));
  const hatKapital = h.personen.some(
    (p) => p.pk.guthaben > 0 || p.freizuegigkeit.guthaben > 0 || p.saeule3a.guthaben > 0,
  );

  const varianten = useMemo(() => {
    if (!hatKapital) return null;
    const roh = staffelVarianten(effH, regeln, heute, JAHRE_LISTE, { pk: st.pk, fz: st.fz, s3a: st.s3a });
    // Anzeige in der gewählten Darstellung (real oder nominal); Ersparnis neu gegen die Basis mit einem Bezug
    const sims = roh.map((v) => ({ ...v, sim: inDarstellung(v.sim, dar) }));
    const steuer = (v: StaffelVariante) => v.sim.zeilen.reduce((s, z) => s + z.steuernKapital, 0);
    const basis = sims[0] ? steuer(sims[0]) : 0;
    return sims.map((v) => ({ ...v, kapitalSteuer: steuer(v), ersparnis: basis - steuer(v) }));
  }, [hatKapital, effH, regeln, heute, st.pk, st.fz, st.s3a, dar]);

  const tipps = useMemo(
    () => (varianten ? steuerTipps(effH, regeln, heute, varianten, namen) : []),
    [varianten, effH, regeln, heute, namen],
  );
  const gewaehlt = varianten?.find((v) => v.jahre === st.jahre) ?? null;

  if (!hatKapital) return null;
  return (
    <Karte
      titel="Kapitalbezüge staffeln und Steuer-Tipps"
      untertitel="Wer Freizügigkeit und 3a in verschiedenen Jahren bezieht, zahlt weniger Steuern auf Kapitalleistungen"
    >
      <p className="klein">
        Kapitalleistungen aus Vorsorge werden getrennt vom Einkommen besteuert; die Leistungen eines Jahres werden
        zusammengezählt und mit einem Tarif besteuert, der mit der Höhe steigt (beim Bund ein Fünftel des Tarifs, Art.
        38 DBG). Mehrere kleinere Bezüge in verschiedenen Jahren senken die Progression.
      </p>
      <Schalter
        label="Kapitalbezüge im Plan staffeln"
        hinweis="Verteilt 3a und Freizügigkeit (optional das PK-Kapital) auf mehrere Jahre. Das ändert Ihren Plan (Steuern, Vermögensverlauf) und wird mit dem Plan gespeichert."
        checked={st.aktiv}
        onChange={(v) => set({ aktiv: v })}
      />
      {st.aktiv ? (
        <>
          <ZahlFeld
            label="Anzahl Bezugsjahre"
            value={st.jahre}
            min={1}
            max={10}
            nachkomma={0}
            einheit="Jahre"
            onChange={(v) => set({ jahre: Math.min(10, Math.max(1, Math.round(v))) })}
            hinweis="Ein Bezug pro Jahr. Es gelten die Fenster: 3a und Freizügigkeit frühestens 5 Jahre vor dem Referenzalter (mit Erwerbstätigkeit höchstens 5 Jahre danach), Freizügigkeit höchstens zwei Einrichtungen. Wenn das Fenster nicht reicht, werden weniger Jahre gerechnet (Hinweis im Ergebnis)."
          />
          <Schalter
            label="Säule 3a staffeln (mehrere Konten nötig)"
            checked={st.s3a}
            onChange={(v) => set({ s3a: v })}
          />
          <Schalter
            label="Freizügigkeit staffeln (höchstens zwei Einrichtungen)"
            checked={st.fz}
            onChange={(v) => set({ fz: v })}
          />
          <Schalter
            label="PK-Kapital in Teilschritten beziehen (Teilpensionierung, höchstens drei)"
            hinweis="Nur wenn Ihr Reglement Teilbezüge in Kapitalform erlaubt und Sie den Lohn dauerhaft reduzieren; sonst rechnen die Steuerbehörden die Bezüge zusammen (Steuerumgehung). Standardmässig aus."
            checked={st.pk}
            onChange={(v) => set({ pk: v })}
          />
        </>
      ) : null}

      {varianten ? (
        <ScrollTabelle label="Steuer je Anzahl Bezugsjahre (Tabelle, scrollbar)">
          <table className="vergleich-tabelle staffel-tabelle">
            <caption>Steuer auf Kapitalleistungen je Anzahl Bezugsjahre ({inFranken(dar)})</caption>
            <thead>
              <tr>
                <th scope="col">Bezugsjahre</th>
                <th scope="col">Steuer auf Kapital</th>
                <th scope="col">Ersparnis</th>
                <th scope="col">Vermögen am Ende ({chfKurz(dar)})</th>
                <th scope="col">Geld reicht bis Alter</th>
              </tr>
            </thead>
            <tbody>
              {varianten.map((v) => (
                <tr key={v.jahre} className={st.aktiv && v.jahre === st.jahre ? 'staffel-aktiv' : undefined}>
                  <th scope="row">{v.jahre === 1 ? '1 (ein Bezug)' : v.jahre}</th>
                  <td>{fmtChf(v.kapitalSteuer)}</td>
                  <td>{v.jahre === 1 ? '–' : fmtChf(v.ersparnis)}</td>
                  <td>{fmtChf(endBetrag(v.sim, dar))}</td>
                  <td>{v.reichtBis === null ? 'bis Planungsende' : v.reichtBis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTabelle>
      ) : null}

      {gewaehlt && st.aktiv ? (
        <ScrollTabelle label="Bezugsjahre im Detail (Tabelle, scrollbar)">
          <table className="vergleich-tabelle staffel-tabelle">
            <caption>
              Bezugsjahre bei {gewaehlt.jahre} {gewaehlt.jahre === 1 ? 'Jahr' : 'Jahren'} ({inFranken(dar)})
            </caption>
            <thead>
              <tr>
                <th scope="col">Jahr</th>
                <th scope="col">Kapitalbezüge</th>
                <th scope="col">Steuer darauf</th>
              </tr>
            </thead>
            <tbody>
              {gewaehlt.sim.zeilen
                .filter((z) => z.kapitalBezuege > 0.5 || z.steuernKapital > 0.5)
                .map((z) => (
                  <tr key={z.jahr}>
                    <th scope="row">{z.jahr}</th>
                    <td>{fmtChf(z.kapitalBezuege)}</td>
                    <td>{fmtChf(z.steuernKapital)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </ScrollTabelle>
      ) : null}

      {tipps.length > 0 ? (
        <>
          <h3>Steuer-Tipps für Ihren Fall</h3>
          <ul className="liste steuer-tipps">
            {tipps.map((t) => (
              <li key={t.id} className={`steuer-tipp steuer-tipp--${t.art}`}>
                <strong>{t.titel}.</strong> {t.text}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="klein">
          Für Ihre Eingaben gibt es im Moment keinen passenden Steuer-Tipp (zu kleine Ersparnis oder keine ordentlichen
          Kapitalbezüge in der Schweiz).
        </p>
      )}

      <p className="klein">
        Modellrechnung, keine Steuer- oder Rechtsberatung. Die Ersparnis hängt von Wohnkanton, Beträgen und der Praxis
        Ihres Steueramts ab; das Modell rechnet mit dem Kapitalleistungstarif Ihres Kantons und der direkten
        Bundessteuer. Die Staffelung setzt getrennte Konten und die zulässigen Bezugsfenster voraus.
      </p>
      <details>
        <summary>Quellen und Stand</summary>
        <ul className="liste klein">
          {STAFFEL_QUELLEN.map((q) => (
            <li key={q.url + q.text}>
              {q.text}:{' '}
              <a href={q.url} target="_blank" rel="noreferrer">
                {q.url}
              </a>{' '}
              (Stand {q.stand})
            </li>
          ))}
        </ul>
      </details>
    </Karte>
  );
}
