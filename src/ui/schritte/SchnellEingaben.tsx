/**
 * Modus «Schnell»: nur die wichtigsten Angaben. Alles andere kommt aus den dokumentierten
 * Schätzwerten (core/schaetzwerte.ts) bzw. aus bereits erfassten Detailwerten.
 */
import {
  detailwerte,
  istManuell,
  mitUmwandlungssatz,
  umwandlungssatzGeschaetztMitGuthaben,
} from '../../core/schaetzwerte';
import { wohneigentumNetto } from '../../core/simulation';
import type { Person } from '../../core/typen';
import { MAX_PLANUNGSALTER, neuePerson, standardHaushalt } from '../../data/defaults';
import { gemeindenVon, KANTON_STATUS_TEXT, KANTONE, kantonNach } from '../../data/kantone';
import { AuswahlFeld, BetragFeld, Schalter, Segmente, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { ErwerbsaufgabeFelder, GeburtFelder, InChSeitFeld } from '../components/PersonBasis';
import { WegzugVorsorgeFelder, WegzugZeitpunktFelder } from '../components/Wegzug';
import { fmtAlter, fmtChf, fmtProzent } from '../format';
import { alterMonate, type SchrittProps, setzeManuell, setzePerson } from '../kontext';
import { UWS_GESCHAETZT, UWS_HILFE, UWS_QUELLE, uwsSchaetzungText } from '../texte';

export function SchnellEingaben(props: SchrittProps) {
  const { h, setH, regeln } = props;
  const detail = detailwerte(h, standardHaushalt(regeln));
  const setZivilstand = (z: 'alleinstehend' | 'verheiratet') =>
    setH((alt) => {
      if (z === 'alleinstehend') return { ...alt, zivilstand: z, personen: alt.personen.slice(0, 1) };
      const personen =
        alt.personen.length >= 2
          ? alt.personen
          : [
              ...alt.personen,
              neuePerson(regeln, { name: 'Person 2', geschlecht: alt.personen[0]?.geschlecht === 'w' ? 'm' : 'w' }),
            ];
      return { ...alt, zivilstand: z, personen };
    });
  const st = h.steuern;
  const kanton = kantonNach(st.kanton);
  const gemeinden = kanton ? gemeindenVon(kanton.code) : [];
  const setS = (patch: Partial<typeof st>) => setH((x) => ({ ...x, steuern: { ...x.steuern, ...patch } }));

  return (
    <>
      <p className="info">
        Schnellstart: wenige Angaben genügen. AHV-Rente, Pensionskasse (falls unbekannt) und Annahmen werden aus den
        gesetzlichen Werten 2026 geschätzt, der Umwandlungssatz ohne Angabe zusätzlich aus dem Durchschnitt der
        Pensionskassen (OAK BV), und im Ergebnis ausgewiesen. Genauer wird es im Modus «Detailliert».
      </p>
      {detail.length > 0 ? (
        <p className="info" role="status">
          <strong>
            {detail.length} {detail.length === 1 ? 'Detailwert ist' : 'Detailwerte sind'} gesetzt
          </strong>{' '}
          und {detail.length === 1 ? 'wird' : 'werden'} berücksichtigt: {detail.slice(0, 6).join(', ')}
          {detail.length > 6 ? ' …' : ''}.
        </p>
      ) : null}
      <Karte titel="Haushalt">
        <Segmente
          label="Konstellation"
          value={h.zivilstand}
          optionen={[
            { value: 'alleinstehend', label: 'Einzelperson' },
            { value: 'verheiratet', label: 'Ehepaar' },
          ]}
          onChange={setZivilstand}
        />
        <ZahlFeld
          label="Planungshorizont (Lebensende)"
          einheit="Jahre"
          value={h.planungsalter}
          min={1}
          max={MAX_PLANUNGSALTER}
          nachkomma={0}
          onChange={(v) => setH((alt) => ({ ...alt, planungsalter: Math.round(v) }))}
          hinweis="Alter der jüngeren Person, bis zu dem das Vermögen reichen soll (Standard 120)."
        />
      </Karte>
      {h.personen.map((p, i) => (
        <SchnellPerson key={`schnell-${i === 0 ? 'a' : 'b'}`} p={p} i={i} props={props} />
      ))}
      <Karte titel="Ausgaben und Wohnort">
        <BetragFeld
          label="Ausgaben pro Jahr (heute)"
          value={h.ausgaben.lebenshaltung}
          min={0}
          max={100_000_000}
          onChange={(v) => setH((x) => ({ ...x, ausgaben: { ...x.ausgaben, lebenshaltung: v } }))}
          hinweis="Lebenshaltung des ganzen Haushalts ohne Steuern und AHV-Beiträge (die werden berechnet)."
        />
        <AuswahlFeld
          label="Wohnkanton"
          value={kanton?.code ?? ''}
          optionen={[
            { value: '', label: 'Bitte wählen' },
            ...KANTONE.map((k) => ({ value: k.code, label: `${k.name} (${k.code})` })),
          ]}
          onChange={(v) => setS({ kanton: v, gemeinde: '' })}
        />
        {kanton ? (
          <p className={`badge badge--${st.eigeneSaetze ? 'naeherung' : kanton.status}`} role="status">
            {st.eigeneSaetze ? 'Eigene effektive Sätze' : KANTON_STATUS_TEXT[kanton.status]}
          </p>
        ) : (
          <p className="warnung">Bitte den Wohnkanton wählen – ohne Kanton rechnet der Rechner ohne Kantonssteuern.</p>
        )}
        {kanton && !st.eigeneSaetze && gemeinden.length > 0 ? (
          <AuswahlFeld
            label="Gemeinde"
            value={st.gemeinde || kanton.hauptort}
            optionen={gemeinden.map((g) => ({ value: g, label: g }))}
            onChange={(v) => setS({ gemeinde: v })}
          />
        ) : null}
      </Karte>
    </>
  );
}

function SchnellPerson({ p, i, props }: { p: Person; i: number; props: SchrittProps }) {
  const { setH, regeln, heute, eff, berechnung } = props;
  const set = (fn: (p: Person) => Person) => setzePerson(setH, i, fn);
  const w = eff.werte[i];
  const pkManuell = istManuell(p, 'pkGuthaben');
  const uwsManuell = istManuell(p, 'pkUmwandlungssatz');
  const effP = eff.haushalt.personen[i];
  const uws = eff.umwandlungssatz[i];
  const freiDetail = p.bargeld + p.sonstiges.wert;
  return (
    <Karte titel={p.name || `Person ${i + 1}`} untertitel={`heute ${fmtAlter(Math.max(0, alterMonate(p, heute)))}`}>
      <GeburtFelder p={p} set={set} heute={heute} />
      <InChSeitFeld p={p} set={set} heute={heute} regeln={regeln} />
      <BetragFeld
        label="Bruttoeinkommen pro Jahr (heute)"
        value={p.lohn}
        min={0}
        max={10_000_000}
        onChange={(v) => set((x) => ({ ...x, lohn: v }))}
        hinweis="AHV-pflichtiger Lohn bzw. Erwerbseinkommen. Daraus werden AHV-Rente und (falls leer) PK geschätzt."
      />
      <ErwerbsaufgabeFelder p={p} set={set} heute={heute} />
      <BetragFeld
        label="PK-Altersguthaben heute (optional)"
        value={pkManuell ? p.pk.guthaben : (w?.pkGuthaben ?? 0)}
        min={0}
        max={100_000_000}
        onChange={(v) => set((x) => setzeManuell({ ...x, pk: { ...x.pk, guthaben: v } }, 'pkGuthaben', true))}
        schaetzung={{
          geschaetzt: !pkManuell,
          wertText: fmtChf(w?.pkGuthaben ?? 0),
          onZuruecksetzen: () => set((x) => setzeManuell(x, 'pkGuthaben', false)),
        }}
        hinweis={
          pkManuell
            ? 'Wert aus dem Vorsorgeausweis.'
            : 'Grobe Schätzung aus BVG-Mindestgutschriften und Mindestzins – bei umhüllenden Kassen meist zu tief. Wert aus dem Vorsorgeausweis eintragen, falls bekannt.'
        }
      />
      <ZahlFeld
        label="Umwandlungssatz laut Vorsorgeausweis (optional)"
        prozent
        value={uwsManuell ? p.pk.umwandlungssatz : (w?.pkUmwandlungssatz ?? 0)}
        min={0}
        max={0.1}
        onChange={(v) => set((x) => mitUmwandlungssatz(x, v))}
        schaetzung={{
          geschaetzt: !uwsManuell,
          wertText: fmtProzent(w?.pkUmwandlungssatz ?? 0),
          onZuruecksetzen: () => set((x) => mitUmwandlungssatz(x, 0)),
        }}
        hinweis={
          !uwsManuell && uws ? (
            <>
              <strong className="uws-schaetzung">{uwsSchaetzungText(uws)}</strong> {UWS_QUELLE(uws)}
            </>
          ) : (
            UWS_HILFE(fmtProzent(regeln.bvg.mindestumwandlungssatz))
          )
        }
      />
      {umwandlungssatzGeschaetztMitGuthaben(p, effP) ? (
        <p className="info" role="status">
          {UWS_GESCHAETZT}
        </p>
      ) : null}
      <BetragFeld
        label="Säule 3a heute (optional)"
        value={p.saeule3a.guthaben}
        min={0}
        max={100_000_000}
        onChange={(v) => set((x) => ({ ...x, saeule3a: { ...x.saeule3a, guthaben: v } }))}
      />
      <BetragFeld
        label="Übriges Vermögen: Konten und Wertschriften"
        value={p.wertschriften}
        min={0}
        max={1_000_000_000}
        onChange={(v) => set((x) => ({ ...x, wertschriften: v }))}
        hinweis={
          freiDetail > 0
            ? `Dazu kommen ${fmtChf(freiDetail)} aus den Detailangaben (Bargeld/Sonstiges).`
            : 'Wird wie Wertschriften verzinst (Börsenrendite). Aufteilung in Bargeld/Sonstiges im Modus «Detailliert».'
        }
      />
      <Schalter
        label="Wohneigentum"
        checked={p.wohneigentum.vorhanden}
        onChange={(v) => set((x) => ({ ...x, wohneigentum: { ...x.wohneigentum, vorhanden: v } }))}
      />
      {p.wohneigentum.vorhanden ? (
        <BetragFeld
          label="Verkehrswert"
          value={p.wohneigentum.verkehrswert}
          min={0}
          max={1_000_000_000}
          onChange={(v) => set((x) => ({ ...x, wohneigentum: { ...x.wohneigentum, verkehrswert: v } }))}
          hinweis={
            p.wohneigentum.hypothek > 0
              ? `Abzüglich Hypothek ${fmtChf(p.wohneigentum.hypothek)} (Detailangabe) = netto ${fmtChf(wohneigentumNetto(p))}.`
              : 'Hypothek im Modus «Detailliert».'
          }
        />
      ) : null}
      <div className="wegzug">
        <WegzugZeitpunktFelder
          p={p}
          set={set}
          hinweis="Z.B. Auswanderung. Ab dem Wegzug werden PK, Freizügigkeit und 3a frei (in jedem Alter) und an der Quelle besteuert."
        />
        <WegzugVorsorgeFelder
          p={p}
          set={set}
          info={berechnung.wunsch?.personen[i] ?? null}
          wohnkanton={props.h.steuern.kanton}
          mitSitzkanton={false}
        />
      </div>
      {effP ? (
        <p className="klein">
          Geschätzt bzw. übernommen: AHV-Rente {fmtChf(effP.ahv.renteMonat)}/Monat
          {istManuell(p, 'ahvRente') ? ' (eigene Eingabe)' : ' (geschätzt)'}, PK-Bezug als{' '}
          {effP.pk.kapitalanteil > 0 ? `${Math.round(effP.pk.kapitalanteil * 100)}% Kapital` : 'Rente'}.
        </p>
      ) : null}
    </Karte>
  );
}
