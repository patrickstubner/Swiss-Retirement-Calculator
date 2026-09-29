/**
 * Wohneigentum (Schema 7): Verkehrswert/Hypothek, separate Wohnkosten (Hypothekarzins, Unterhalt,
 * Eigenmietwert bis 2028, Vermietung nach dem Wegzug) und Verkauf mit Grundstückgewinnsteuer.
 * Rechnung in core/simulation.ts und core/grundstueckgewinn.ts.
 */
import { wohneigentumNetto } from '../../core/simulation';
import type { Haushalt, Person, VerkaufZeitpunkt, Wohneigentum } from '../../core/typen';
import { fmtChf, MONATSNAMEN } from '../format';
import type { Setzer } from '../kontext';
import { VEREINFACHUNG_WOHNEIGENTUM } from '../texte';
import { AuswahlFeld, BetragFeld, Schalter, Segmente, ZahlFeld } from './Felder';

const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));

/** Text zur Grundstückgewinnsteuer je nach Kanton */
export function ggstText(kanton: string): string {
  if (kanton === 'ZH')
    return 'Grundstückgewinnsteuer Kanton Zürich nach § 225 StG: Tarif von 10 % bis 40 %, Zuschlag bei weniger als 2 Jahren Besitz, Ermässigung ab 5 Jahren (bis 50 % ab 20 Jahren); Gewinne unter CHF 5 000 steuerfrei.';
  if (kanton === 'AG')
    return 'Grundstückgewinnsteuer Kanton Aargau nach § 109 StG: 40 % im ersten Besitzjahr, sinkend bis 5 % ab 25 Jahren. Pauschale Anlagekosten (§ 105 StG) sind nicht gerechnet.';
  return 'Für diesen Kanton ist kein Tarif hinterlegt: Die App rechnet als Näherung mit dem Tarif des Kantons Zürich. Besser: eigenen Satz erfassen.';
}

interface Props {
  p: Person;
  set: (fn: (p: Person) => Person) => void;
  separat: boolean;
  kanton: string;
}

export function WohneigentumFelder({ p, set, separat, kanton }: Props) {
  const w = p.wohneigentum;
  const setW = (patch: Partial<Wohneigentum>) => set((x) => ({ ...x, wohneigentum: { ...x.wohneigentum, ...patch } }));
  const v = w.verkauf;
  const setV = (patch: Partial<Wohneigentum['verkauf']>) =>
    set((x) => ({ ...x, wohneigentum: { ...x.wohneigentum, verkauf: { ...x.wohneigentum.verkauf, ...patch } } }));
  const wegzug = p.wohnsitzAusland.aktiv;
  return (
    <>
      <Schalter label="Wohneigentum" checked={w.vorhanden} onChange={(vorhanden) => setW({ vorhanden })} />
      {w.vorhanden ? (
        <>
          <div className="raster">
            <BetragFeld
              label="Verkehrswert"
              value={w.verkehrswert}
              min={0}
              max={1_000_000_000}
              onChange={(verkehrswert) => setW({ verkehrswert })}
            />
            <BetragFeld
              label="Hypothek (optional)"
              value={w.hypothek}
              min={0}
              max={1_000_000_000}
              onChange={(hypothek) => setW({ hypothek })}
            />
          </div>
          <p className="info">
            Nettowert: <strong>{fmtChf(wohneigentumNetto(p))}</strong>. {VEREINFACHUNG_WOHNEIGENTUM}
          </p>

          {separat ? (
            <div className="unterkarte">
              <p className="klein">
                <strong>Wohnkosten dieser Liegenschaft</strong> (separat gerechnet, siehe «Wohnkosten» unten).
              </p>
              <div className="raster">
                <ZahlFeld
                  label="Hypothekarzins"
                  prozent
                  value={w.hypothekarzins}
                  min={0}
                  max={0.2}
                  onChange={(hypothekarzins) => setW({ hypothekarzins })}
                  hinweis="Nominal pro Jahr. Vorschlag: Durchschnittszins aller Schweizer Hypotheken (BWO, 30.6.2026: 1.31 %)."
                />
                <Segmente<'prozent' | 'chf'>
                  label="Unterhalt"
                  value={w.unterhaltArt}
                  optionen={[
                    { value: 'prozent', label: '% des Werts' },
                    { value: 'chf', label: 'CHF pro Jahr' },
                  ]}
                  onChange={(unterhaltArt) => setW({ unterhaltArt })}
                />
              </div>
              {w.unterhaltArt === 'prozent' ? (
                <ZahlFeld
                  label="Unterhalt pro Jahr"
                  prozent
                  value={w.unterhaltProzent}
                  min={0}
                  max={0.2}
                  onChange={(unterhaltProzent) => setW({ unterhaltProzent })}
                  hinweis="In % des aktuellen Verkehrswerts. Eigene Schätzung (keine amtliche Zahl)."
                />
              ) : (
                <BetragFeld
                  label="Unterhalt pro Jahr (heute)"
                  value={w.unterhaltChf}
                  min={0}
                  max={10_000_000}
                  onChange={(unterhaltChf) => setW({ unterhaltChf })}
                  hinweis="In heutigen Franken, wächst mit der Teuerung."
                />
              )}
              <BetragFeld
                label="Eigenmietwert pro Jahr (bis 2028)"
                value={w.eigenmietwert}
                min={0}
                max={10_000_000}
                onChange={(eigenmietwert) => setW({ eigenmietwert })}
                hinweis="Laut Steuererklärung. Bis Ende 2028 steuerbar, abzüglich Hypothekarzins und Unterhalt; ab 2029 abgeschafft (samt diesen Abzügen). 0 = nicht gerechnet."
              />
              {wegzug ? (
                <>
                  <Segmente<Wohneigentum['nachWegzug']>
                    label="Nach dem Wegzug"
                    value={w.nachWegzug}
                    optionen={[
                      { value: 'leer', label: 'Leer' },
                      { value: 'vermietet', label: 'Vermietet' },
                    ]}
                    onChange={(nachWegzug) => setW({ nachWegzug })}
                  />
                  {w.nachWegzug === 'vermietet' ? (
                    <BetragFeld
                      label="Mieteinnahmen pro Monat (heute)"
                      value={w.mieteinnahmenMonat}
                      min={0}
                      max={1_000_000}
                      onChange={(mieteinnahmenMonat) => setW({ mieteinnahmenMonat })}
                      hinweis="Brutto, in heutigen Franken. In der Schweiz steuerbar (abzüglich Unterhalt und Zins; Zins ab 2029 nur anteilig), zum Satz des gesamten Einkommens (vereinfacht). Steuer im Zielland nicht gerechnet."
                    />
                  ) : (
                    <p className="klein">
                      Leer: Zins und Unterhalt laufen weiter, keine Einnahmen. Ab 2029 kein Eigenmietwert mehr; eine
                      allfällige kantonale Steuer auf Zweitliegenschaften ist nicht gerechnet.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          <Schalter
            label="Verkauf planen"
            hinweis="Mit Grundstückgewinnsteuer, Verkaufskosten und Rückzahlung der Hypothek; der Rest fliesst in die Wertschriften."
            checked={v.aktiv}
            onChange={(aktiv) => setV({ aktiv })}
          />
          {v.aktiv ? (
            <div className="unterkarte">
              <Segmente<VerkaufZeitpunkt>
                label="Verkauf"
                value={v.zeitpunkt}
                optionen={[
                  { value: 'ruecktritt', label: 'Beim Rücktritt' },
                  { value: 'wegzug', label: 'Beim Wegzug' },
                  { value: 'datum', label: 'Datum' },
                ]}
                onChange={(zeitpunkt) => setV({ zeitpunkt })}
              />
              {v.zeitpunkt === 'datum' ? (
                <div className="raster">
                  <AuswahlFeld
                    label="Verkauf im Monat"
                    value={v.datum.monat}
                    optionen={MONATE}
                    onChange={(monat) => setV({ datum: { ...v.datum, monat } })}
                  />
                  <ZahlFeld
                    label="Jahr"
                    value={v.datum.jahr}
                    min={1900}
                    max={2200}
                    nachkomma={0}
                    onChange={(j) => setV({ datum: { ...v.datum, jahr: Math.round(j) } })}
                  />
                </div>
              ) : v.zeitpunkt === 'wegzug' && !wegzug ? (
                <p className="warnung">Kein Wegzug erfasst – ohne Wegzug wird nicht verkauft.</p>
              ) : null}
              <BetragFeld
                label="Anlagekosten"
                value={v.anlagekosten}
                min={0}
                max={1_000_000_000}
                onChange={(anlagekosten) => setV({ anlagekosten })}
                hinweis="Kaufpreis inkl. wertvermehrende Investitionen (nicht Unterhalt), in damaligen Franken."
              />
              <div className="raster">
                <AuswahlFeld
                  label="Gekauft im Monat"
                  value={v.kauf.monat}
                  optionen={MONATE}
                  onChange={(monat) => setV({ kauf: { ...v.kauf, monat } })}
                />
                <ZahlFeld
                  label="Jahr"
                  value={v.kauf.jahr}
                  min={1900}
                  max={2200}
                  nachkomma={0}
                  onChange={(j) => setV({ kauf: { ...v.kauf, jahr: Math.round(j) } })}
                  hinweis="Beginn der Besitzdauer"
                />
              </div>
              <ZahlFeld
                label="Verkaufskosten"
                prozent
                value={v.verkaufskostenAnteil}
                min={0}
                max={0.2}
                onChange={(verkaufskostenAnteil) => setV({ verkaufskostenAnteil })}
                hinweis="Makler, Inserate usw. in % des Verkaufspreises; mindern den steuerbaren Gewinn."
              />
              <Schalter
                label="Eigener Steuersatz auf dem Gewinn"
                hinweis={ggstText(kanton)}
                checked={v.eigenerSatz !== null}
                onChange={(an) => setV({ eigenerSatz: an ? 0.1 : null })}
              />
              {v.eigenerSatz !== null ? (
                <ZahlFeld
                  label="Grundstückgewinnsteuer (effektiv)"
                  prozent
                  value={v.eigenerSatz}
                  min={0}
                  max={0.6}
                  onChange={(eigenerSatz) => setV({ eigenerSatz })}
                  hinweis="In % des Gewinns, z.B. aus einer Berechnung der Gemeinde."
                />
              ) : null}
              <p className="klein">
                Die Steuer ist in der Gemeinde geschuldet, in der die Liegenschaft liegt – auch nach einem Wegzug ins
                Ausland. Nicht gerechnet: Aufschub bei Kauf eines Ersatz-Eigenheims (Ersatzbeschaffung, z.B. § 216 Abs.
                3 lit. i StG ZH) und in ZH bei über 20 Jahren Besitz der Verkehrswert vor 20 Jahren statt des
                Kaufpreises (§ 220 Abs. 2 StG). Verbucht wird der Verkauf am Ende des Verkaufsjahres.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Haushalt: separate Wohnkosten ein/aus und Miete */
export function WohnkostenFelder({ h, setH }: { h: Haushalt; setH: Setzer }) {
  const wo = h.wohnen;
  const set = (patch: Partial<Haushalt['wohnen']>) => setH((x) => ({ ...x, wohnen: { ...x.wohnen, ...patch } }));
  return (
    <>
      <Schalter
        label="Wohnkosten separat rechnen"
        hinweis={
          wo.separat
            ? 'An: Miete, Hypothekarzins und Unterhalt rechnet die App separat. Nehmen Sie diese Kosten aus den Lebenshaltungskosten heraus – sonst zählen sie doppelt.'
            : 'Aus (Standard): Ihre Wohnkosten (Miete bzw. Hypothekarzins und Unterhalt) stecken in den Lebenshaltungskosten.'
        }
        checked={wo.separat}
        onChange={(separat) => set({ separat })}
      />
      {wo.separat ? (
        <BetragFeld
          label="Miete pro Monat in der Schweiz (heute)"
          value={wo.mieteMonat}
          min={0}
          max={1_000_000}
          onChange={(mieteMonat) => set({ mieteMonat })}
          hinweis="Gilt, solange Sie in der Schweiz zur Miete wohnen (ohne Wohneigentum oder nach dem Verkauf) – bis zum Wegzug. In heutigen Franken, wächst mit der Teuerung wie die Ausgaben. Wohnkosten im Zielland gehören in die Ausgaben(-phasen)."
        />
      ) : null}
    </>
  );
}
