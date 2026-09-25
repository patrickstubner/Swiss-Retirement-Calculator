/**
 * Wegzug ins Ausland: gemeinsame Felder für «Personen», «Einkommen & Vorsorge» und den Modus
 * «Schnell» (derselbe Zustand `Person.wohnsitzAusland`). Die Vorsorgefelder steuern die
 * Barauszahlung von PK, Freizügigkeit und 3a (Art. 5 Abs. 1 lit. a FZG, Art. 25f FZG,
 * Art. 3 Abs. 2 lit. d BVV 3), siehe core/simulation.ts.
 */
import type { Monat, Person, PersonInfo, WohnsitzAusland, ZeitpunktModus } from '../../core/typen';
import { monatBeiAlterMonate, wegzugIndex } from '../../core/zeitpunkt';
import { KANTONE, kantonNach } from '../../data/kantone';
import { WEGZUGS_LAENDER, wegzugsLand } from '../../data/laender';
import { fmtAlter, fmtChf, fmtMonat, MONATSNAMEN } from '../format';
import { AuswahlFeld, Schalter, Segmente, ZahlFeld } from './Felder';

const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));
const MONATE_ZUSATZ = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i} Mt.` }));
const MODI = [
  { value: 'alter', label: 'Alter' },
  { value: 'datum', label: 'Datum' },
] as const;
const LAENDER = [
  { value: '', label: 'Bitte wählen' },
  ...WEGZUGS_LAENDER.map((l) => ({ value: l.code, label: `${l.name} (${l.euEfta ? 'EU/EFTA' : 'nicht EU/EFTA'})` })),
];

interface Props {
  p: Person;
  set: (fn: (p: Person) => Person) => void;
}

const setzeW = (set: Props['set']) => (patch: Partial<WohnsitzAusland>) =>
  set((x) => ({ ...x, wohnsitzAusland: { ...x.wohnsitzAusland, ...patch } }));

/** Schalter «Wegzug geplant», Zeitpunkt (Alter oder Datum) und Zielland. */
export function WegzugZeitpunktFelder({ p, set, hinweis }: Props & { hinweis?: string }) {
  const w = p.wohnsitzAusland;
  const setW = setzeW(set);
  const weg = wegzugIndex(p);
  const wegMonat: Monat | null = weg === null ? null : { jahr: Math.floor(weg / 12), monat: (weg % 12) + 1 };
  const wegAlter = weg === null ? null : weg - (p.geburtsjahr * 12 + p.geburtsmonat - 1);
  const alterJ = Math.floor(w.alter + 1e-9);
  const alterM = Math.round((w.alter - alterJ) * 12);
  const setModus = (m: ZeitpunktModus) =>
    set((x) => {
      const wx = x.wohnsitzAusland;
      const idx = wegzugIndex(x);
      if (idx === null) return { ...x, wohnsitzAusland: { ...wx, modus: m } };
      const alter = (idx - (x.geburtsjahr * 12 + x.geburtsmonat - 1)) / 12;
      return {
        ...x,
        wohnsitzAusland:
          m === 'datum'
            ? { ...wx, modus: m, datum: monatBeiAlterMonate(x, Math.round(alter * 12)) }
            : { ...wx, modus: m, alter: Math.max(0, alter) },
      };
    });
  return (
    <>
      <Schalter
        label="Endgültiger Wegzug aus der Schweiz geplant"
        hinweis={
          hinweis ??
          'Wohnsitz ausserhalb der Schweiz ab einem Alter oder Datum. Beeinflusst AHV, die Barauszahlung von Vorsorgeguthaben und deren Besteuerung.'
        }
        checked={w.aktiv}
        onChange={(v) => setW({ aktiv: v })}
      />
      {w.aktiv ? (
        <>
          <Segmente label="Wohnsitz im Ausland ab" value={w.modus} optionen={MODI} onChange={setModus} />
          {w.modus === 'alter' ? (
            <div className="raster">
              <ZahlFeld
                label="Wegzug mit"
                einheit="Jahren"
                value={alterJ}
                min={0}
                max={100}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setW({ alter: Math.round(v) + alterM / 12 })}
              />
              <AuswahlFeld
                label="und"
                value={alterM}
                optionen={MONATE_ZUSATZ}
                onChange={(v) => setW({ alter: alterJ + v / 12 })}
              />
            </div>
          ) : (
            <div className="raster">
              <AuswahlFeld
                label="Wohnsitz im Ausland ab (Monat)"
                value={w.datum.monat}
                optionen={MONATE}
                onChange={(v) => setW({ datum: { ...w.datum, monat: v } })}
              />
              <ZahlFeld
                label="Jahr"
                value={w.datum.jahr}
                min={p.geburtsjahr}
                max={p.geburtsjahr + 100}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setW({ datum: { ...w.datum, jahr: Math.round(v) } })}
              />
            </div>
          )}
          {wegMonat && wegAlter !== null ? (
            <p className="klein">
              Wohnsitz im Ausland ab {fmtMonat(wegMonat)} (mit {fmtAlter(Math.max(0, wegAlter))}).
            </p>
          ) : null}
          <AuswahlFeld
            label="Zielland"
            value={w.land}
            optionen={LAENDER}
            onChange={(v) => setW({ land: v })}
            hinweis="Massgebend für freiwillige AHV und Barauszahlung: Wohnsitz in der EU/EFTA oder ausserhalb."
          />
        </>
      ) : null}
    </>
  );
}

/** Barauszahlung beim Wegzug: Schalter und Ergebnis (Beträge, Quellensteuer) aus der Simulation. */
export function WegzugVorsorgeFelder({
  p,
  set,
  info,
  wohnkanton,
  mitSitzkanton,
}: Props & { info: PersonInfo | null; wohnkanton: string; mitSitzkanton: boolean }) {
  const w = p.wohnsitzAusland;
  if (!w.aktiv) return null;
  const setW = setzeW(set);
  const land = wegzugsLand(w.land);
  const bar = info?.barauszahlung ?? null;
  const sitz = w.sitzkantonVorsorge || wohnkanton;
  const sitzName = kantonNach(sitz)?.name;
  return (
    <div className="wegzug-vorsorge">
      <Schalter
        label="Barauszahlung bei Wegzug (PK, Freizügigkeit, 3a)"
        hinweis="Bei endgültigem Verlassen der Schweiz kann das Guthaben in jedem Alter bar bezogen werden (Art. 5 Abs. 1 lit. a FZG; 3a: Art. 3 Abs. 2 lit. d BVV 3). Verheiratete: nur mit schriftlicher Zustimmung des Ehegatten. Aus: ordentlicher Bezug im Alter."
        checked={w.barauszahlung}
        onChange={(v) => setW({ barauszahlung: v })}
      />
      {w.barauszahlung && land?.euEfta ? (
        <Schalter
          label="Im neuen Land nicht obligatorisch versichert (Alter, Tod, Invalidität)"
          hinweis="EU/EFTA: Wer dort obligatorisch versichert ist, erhält den obligatorischen Teil (BVG-Altersguthaben) nicht bar; er bleibt auf einem Freizügigkeitskonto gesperrt (Art. 25f FZG). Das Überobligatorium ist immer frei. Nachweis bei der Vorsorgeeinrichtung (z.B. Selbstständige, Nichterwerbstätige – je nach Land prüfen)."
          checked={w.nichtObligatorischVersichert}
          onChange={(v) => setW({ nichtObligatorischVersichert: v })}
        />
      ) : null}
      {w.barauszahlung && mitSitzkanton ? (
        <AuswahlFeld
          label="Sitzkanton der Pensionskasse / Freizügigkeitseinrichtung"
          value={w.sitzkantonVorsorge}
          optionen={[
            { value: '', label: `Wie Wohnkanton${kantonNach(wohnkanton) ? ` (${wohnkanton})` : ''}` },
            ...KANTONE.map((k) => ({ value: k.code, label: `${k.name} (${k.code})` })),
          ]}
          onChange={(v) => setW({ sitzkantonVorsorge: v })}
          hinweis="Nach dem Wegzug wird das Kapital an der Quelle besteuert, nach dem Tarif des Kantons, in dem die Einrichtung ihren Sitz hat (nicht des Wohnkantons). Der Sitz steht auf dem Vorsorgeausweis."
        />
      ) : null}
      {w.barauszahlung ? (
        !land ? (
          <p className="warnung">Bitte das Zielland wählen – erst dann wird die Barauszahlung gerechnet.</p>
        ) : bar ? (
          <div className="info" role="status">
            <p>
              <strong>Barauszahlung ab {fmtMonat(bar.monat)}</strong> (in heutigen Franken):
            </p>
            <ul className="liste">
              {bar.pk > 0 || bar.pkGesperrt > 0 ? (
                <li>
                  Pensionskasse: <strong>{fmtChf(bar.pk)}</strong> als Kapital, keine PK-Rente
                  {bar.pkGesperrt > 0
                    ? `; obligatorischer Teil ca. ${Math.round(bar.anteilObligatorium * 100)}% (${fmtChf(bar.pkGesperrt)}) bleibt gesperrt (Art. 25f FZG) und wird als Freizügigkeitsguthaben${info?.freizuegigkeitStart ? ` ab ${fmtMonat(info.freizuegigkeitStart)}` : ''} ausbezahlt – Aufteilung geschätzt (Näherung)`
                    : ''}
                  .
                </li>
              ) : null}
              {bar.freizuegigkeit > 0 ? (
                <li>
                  Freizügigkeitsguthaben: <strong>{fmtChf(bar.freizuegigkeit)}</strong>
                </li>
              ) : null}
              {bar.saeule3a > 0 ? (
                <li>
                  Säule 3a: <strong>{fmtChf(bar.saeule3a)}</strong>
                  {land.euEfta ? ' (auch in die EU/EFTA ganz frei – Auslegung, OFFEN)' : ''}
                </li>
              ) : null}
              {bar.euEfta && !bar.voll && p.freizuegigkeit.guthaben > 0 ? (
                <li>Bestehendes Freizügigkeitsguthaben bleibt gesperrt (Anteil Obligatorium unbekannt, Näherung).</li>
              ) : null}
            </ul>
            <p className="klein">
              Besteuerung: Schweizer Quellensteuer (Bund + Sitzkanton{sitzName ? ` ${sitzName}` : ''}) statt der
              Kapitalleistungssteuer des Wohnkantons
              {info && info.quellensteuerKapital > 0 ? `, total ca. ${fmtChf(info.quellensteuerKapital)}` : ''}.
              {land.pkKapitalCh ? ` ${land.name}: ${land.pkKapitalCh} (ESTV, Stand 1.1.2026).` : ''} Rückforderung
              gemäss DBA und Steuern im Wohnsitzstaat sind nicht gerechnet (Näherung).
            </p>
          </div>
        ) : (
          <p className="info">
            Keine Barauszahlung gerechnet: Der Wegzug liegt nicht vor dem frühesten Bezugsalter (dann gilt der
            ordentliche Bezug als Altersleistung) oder es ist kein Guthaben vorhanden.
          </p>
        )
      ) : null}
    </div>
  );
}
