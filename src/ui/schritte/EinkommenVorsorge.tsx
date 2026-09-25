import { useState } from 'react';
import {
  ahvAufschubZuschlag,
  ahvFruehestesBezugsalter,
  ahvMaxVorbezugMonate,
  ahvMdjeAusRente,
  ahvVorbezugKuerzung,
  istUebergangsFrau,
  pruefeAhvVerschiebung,
} from '../../core/ahv';
import { istManuell, mitUmwandlungssatz, umwandlungssatzGeschaetztMitGuthaben } from '../../core/schaetzwerte';
import type { AuslandRente, Person, SchaetzFeld } from '../../core/typen';
import { neueAuslandRente, WAEHRUNGEN } from '../../data/defaults';
import { AhvSchaetzhilfe } from '../components/AhvSchaetzhilfe';
import { AuswahlFeld, BetragFeld, Schalter, Segmente, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { WegzugVorsorgeFelder, WegzugZeitpunktFelder } from '../components/Wegzug';
import { fmtChf, fmtMonat, fmtProzent } from '../format';
import { type SchrittProps, setzeManuell, setzePerson } from '../kontext';
import { UWS_GESCHAETZT, UWS_HILFE, UWS_QUELLE, uwsSchaetzungText } from '../texte';

export function EinkommenVorsorge(props: SchrittProps) {
  const { h } = props;
  const [aktiv, setAktiv] = useState(0);
  const i = Math.min(aktiv, h.personen.length - 1);
  const p = h.personen[i];
  if (!p) return null;
  return (
    <>
      {h.personen.length > 1 ? (
        <div className="personenwahl">
          <Segmente
            label="Person"
            value={String(i)}
            optionen={h.personen.map((x, j) => ({ value: String(j), label: x.name || `Person ${j + 1}` }))}
            onChange={(v) => setAktiv(Number(v))}
          />
        </div>
      ) : null}
      <PersonVorsorge key={i} p={p} i={i} props={props} />
    </>
  );
}

function PersonVorsorge({ p, i, props }: { p: Person; i: number; props: SchrittProps }) {
  const { setH, regeln, eff, berechnung } = props;
  const info = berechnung.wunsch?.personen[i] ?? null;
  const wz = p.wohnsitzAusland;
  const barPk =
    info?.barauszahlung && (info.barauszahlung.pk > 0 || info.barauszahlung.pkGesperrt > 0) ? info.barauszahlung : null;
  const set = (fn: (p: Person) => Person) => setzePerson(setH, i, fn);
  const w = eff.werte[i];
  const effP = eff.haushalt.personen[i] ?? p;
  const uws = eff.umwandlungssatz[i];
  const bvgSchaetzung = Math.min(w?.pkGuthaben ?? 0, effP.pk.guthaben);
  /** Anzeige für geschätzte Felder: Schätzwert mit Badge oder eigene Eingabe mit Rücksetzen */
  const schaetz = (feld: SchaetzFeld, text: string) => ({
    geschaetzt: !istManuell(p, feld),
    wertText: text,
    onZuruecksetzen: () => set((x) => setzeManuell(x, feld, false)),
  });
  const r = regeln.ahv;
  const verschiebung = p.ahv.bezugVerschiebungMonate;
  const bezugArt = verschiebung < 0 ? 'vorbezug' : verschiebung > 0 ? 'aufschub' : 'ordentlich';
  const maxVorbezug = ahvMaxVorbezugMonate(p.geburtsjahr, p.geschlecht, r);
  const fehlerVerschiebung = pruefeAhvVerschiebung(verschiebung, p.geburtsjahr, p.geschlecht, r);
  const mdje = p.ahv.mdje > 0 ? p.ahv.mdje : ahvMdjeAusRente(p.ahv.renteMonat, r);
  let bezugInfo = '';
  if (!fehlerVerschiebung) {
    if (verschiebung < 0)
      bezugInfo = `Kürzung ${fmtProzent(ahvVorbezugKuerzung(-verschiebung, p.geburtsjahr, p.geschlecht, mdje, r))} lebenslang`;
    if (verschiebung > 0) bezugInfo = `Zuschlag ${fmtProzent(ahvAufschubZuschlag(verschiebung, r))} lebenslang`;
  }
  const uebergang = istUebergangsFrau(p.geburtsjahr, p.geschlecht, r);
  const ahvFrueh = ahvFruehestesBezugsalter(p.geburtsjahr, p.geschlecht, r);
  const bezugsalter = regeln.bvg.bezugsalter;

  return (
    <>
      <Karte titel="Erwerbseinkommen">
        <BetragFeld
          label="Bruttolohn pro Jahr (heute)"
          value={p.lohn}
          min={0}
          max={10_000_000}
          onChange={(v) => set((x) => ({ ...x, lohn: v }))}
          hinweis="Bis zur Erwerbsaufgabe. Davon gehen AHV/IV/EO 5,3% und ALV 1,1% ab."
        />
        <ZahlFeld
          label="Reale Lohnentwicklung pro Jahr"
          prozent
          value={p.lohnwachstumReal}
          min={-0.1}
          max={0.1}
          onChange={(v) => set((x) => ({ ...x, lohnwachstumReal: v }))}
          hinweis="Über der Teuerung. 0% = Lohn wächst nur mit der Teuerung."
        />
      </Karte>

      <Karte titel="AHV (1. Säule)">
        <BetragFeld
          label="Erwartete AHV-Rente pro Monat"
          value={istManuell(p, 'ahvRente') ? p.ahv.renteMonat : effP.ahv.renteMonat}
          min={0}
          max={10000}
          onChange={(v) =>
            set((x) => setzeManuell({ ...x, ahv: { ...x.ahv, modus: 'eingabe', renteMonat: v } }, 'ahvRente', true))
          }
          schaetzung={schaetz('ahvRente', `${fmtChf(w?.ahvRente ?? 0)}/Mt.`)}
          hinweis={`Gemäss Rentenvorausberechnung der Ausgleichskasse oder AHV-Schätzhilfe, in heutigen Franken, ungekürzt im Referenzalter (Einzelrente max. ${fmtChf(r.maximalrenteMonat)}). 13. Rente und Plafonierung rechnet die Simulation.`}
        />
        <AhvSchaetzhilfe
          p={p}
          partner={props.h.personen.find((_, j) => j !== i) ?? null}
          verheiratet={props.h.zivilstand === 'verheiratet'}
          regeln={regeln}
          set={set}
        />
        <div className="feld feld--nurlesen">
          <span className="feld__titel">AHV: frühester Bezug (Vorbezug)</span>
          <output className="feld__wert">ab {ahvFrueh} Jahren</output>
          <small className="feld__hinweis">
            Keine Eingabe: gesetzlich festgelegt und aus Jahrgang und Geschlecht abgeleitet (ab 63; Frauen der Jahrgänge
            1961–1969 ab 62). Höchstens {maxVorbezug} Monate Vorbezug.
          </small>
        </div>
        <div className="raster">
          <AuswahlFeld
            label="AHV-Bezug"
            value={bezugArt}
            optionen={[
              { value: 'ordentlich', label: 'Im Referenzalter' },
              { value: 'vorbezug', label: 'Vorbezug' },
              { value: 'aufschub', label: 'Aufschub' },
            ]}
            onChange={(v) =>
              set((x) => ({
                ...x,
                ahv: {
                  ...x.ahv,
                  bezugVerschiebungMonate: v === 'vorbezug' ? -Math.min(12, maxVorbezug) : v === 'aufschub' ? 12 : 0,
                },
              }))
            }
          />
          {bezugArt !== 'ordentlich' ? (
            <ZahlFeld
              label={bezugArt === 'vorbezug' ? 'Vorbezug um' : 'Aufschub um'}
              einheit="Monate"
              value={Math.abs(verschiebung)}
              min={bezugArt === 'vorbezug' ? 1 : r.aufschub.minMonate}
              max={bezugArt === 'vorbezug' ? maxVorbezug : r.aufschub.maxMonate}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) =>
                set((x) => ({
                  ...x,
                  ahv: { ...x.ahv, bezugVerschiebungMonate: (bezugArt === 'vorbezug' ? -1 : 1) * Math.round(v) },
                }))
              }
            />
          ) : null}
        </div>
        {bezugInfo ? <p className="info">{bezugInfo}</p> : null}
        {fehlerVerschiebung ? <p className="warnung">{fehlerVerschiebung}</p> : null}
        {uebergang ? (
          <p className="info">
            Übergangsgeneration (Jg. 1961–1969): Vorbezug ab 62 mit reduzierten Kürzungssätzen; ohne Vorbezug
            lebenslanger Rentenzuschlag.
          </p>
        ) : null}
      </Karte>

      <Karte titel="Wegzug ins Ausland" untertitel="Endgültiger Wegzug: Vorsorgeguthaben können bar bezogen werden">
        <div id={`wegzug-vorsorge-${i}`} className="wegzug-karte">
          <WegzugZeitpunktFelder
            p={p}
            set={set}
            hinweis="Gleiche Angabe wie im Schritt «Personen». Bei endgültigem Wegzug werden Pensionskasse, Freizügigkeit und 3a ab dem Wegzug frei – in jedem Alter (ausserhalb EU/EFTA ganz, in der EU/EFTA ohne das Obligatorium)."
          />
          <WegzugVorsorgeFelder p={p} set={set} info={info} wohnkanton={props.h.steuern.kanton} mitSitzkanton />
        </div>
      </Karte>

      <Karte titel="Pensionskasse (2. Säule)" untertitel="Werte aus dem Vorsorgeausweis">
        <BetragFeld
          label="Altersguthaben heute"
          value={istManuell(p, 'pkGuthaben') ? p.pk.guthaben : (w?.pkGuthaben ?? 0)}
          min={0}
          max={100_000_000}
          onChange={(v) => set((x) => setzeManuell({ ...x, pk: { ...x.pk, guthaben: v } }, 'pkGuthaben', true))}
          schaetzung={schaetz('pkGuthaben', fmtChf(w?.pkGuthaben ?? 0))}
          hinweis={
            istManuell(p, 'pkGuthaben')
              ? undefined
              : 'Grobe Schätzung aus BVG-Mindestgutschriften ab 25 (bzw. ab Zuzug) und BVG-Mindestzins – bei umhüllenden Kassen meist zu tief.'
          }
        />
        <BetragFeld
          label="Sparbeitrag pro Jahr (Arbeitnehmer + Arbeitgeber)"
          value={istManuell(p, 'pkSparbeitrag') ? p.pk.sparbeitragJahr : (w?.pkSparbeitrag ?? 0)}
          min={0}
          max={1_000_000}
          onChange={(v) =>
            set((x) =>
              setzeManuell(
                { ...x, pk: { ...x.pk, beitragModus: 'eingabe', sparbeitragJahr: v } },
                'pkSparbeitrag',
                true,
              ),
            )
          }
          schaetzung={schaetz('pkSparbeitrag', fmtChf(w?.pkSparbeitrag ?? 0))}
          hinweis={
            istManuell(p, 'pkSparbeitrag')
              ? 'Gemäss Vorsorgeausweis (Altersgutschriften pro Jahr).'
              : 'Schätzung: BVG-Mindest-Altersgutschrift auf dem koordinierten Lohn (steigt mit dem Alter). Wert aus dem Vorsorgeausweis eintragen.'
          }
        />
        <div className="raster">
          <ZahlFeld
            label="Davon Arbeitnehmeranteil"
            prozent
            value={p.pk.anteilArbeitnehmer}
            min={0}
            max={1}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, anteilArbeitnehmer: v } }))}
          />
          <ZahlFeld
            label="Verzinsung (nominal)"
            prozent
            value={p.pk.zins}
            min={-0.05}
            max={0.1}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, zins: v } }))}
            hinweis={`BVG-Mindestzins 2026: ${fmtProzent(regeln.bvg.mindestzins2026, 2)}`}
          />
        </div>
        <div className="raster">
          <ZahlFeld
            label="Umwandlungssatz"
            prozent
            value={istManuell(p, 'pkUmwandlungssatz') ? p.pk.umwandlungssatz : effP.pk.umwandlungssatz}
            min={0}
            max={0.1}
            onChange={(v) => set((x) => mitUmwandlungssatz(x, v))}
            schaetzung={schaetz('pkUmwandlungssatz', fmtProzent(w?.pkUmwandlungssatz ?? 0))}
            hinweis={
              !istManuell(p, 'pkUmwandlungssatz') && uws ? (
                <>
                  <strong className="uws-schaetzung">{uwsSchaetzungText(uws)}</strong> {UWS_QUELLE(uws)}{' '}
                  {umwandlungssatzGeschaetztMitGuthaben(p, effP) ? UWS_GESCHAETZT : null}
                </>
              ) : (
                UWS_HILFE(fmtProzent(regeln.bvg.mindestumwandlungssatz))
              )
            }
          />
          <ZahlFeld
            label="Kapitalbezug"
            prozent
            value={p.pk.kapitalanteil}
            min={0}
            max={1}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, kapitalanteil: v } }))}
            hinweis="Anteil als Kapital, Rest als Rente. Gesetzlich mind. ¼ des Obligatoriums möglich, mehr gemäss Reglement."
          />
        </div>
        {!istManuell(p, 'pkUmwandlungssatz') ? (
          <BetragFeld
            label="Davon BVG-Altersguthaben (Obligatorium, optional)"
            value={p.pk.bvgGuthaben > 0 ? p.pk.bvgGuthaben : bvgSchaetzung}
            min={0}
            max={100_000_000}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, bvgGuthaben: Math.max(0, v) } }))}
            schaetzung={{
              geschaetzt: !(p.pk.bvgGuthaben > 0),
              wertText: fmtChf(bvgSchaetzung),
              onZuruecksetzen: () => set((x) => ({ ...x, pk: { ...x.pk, bvgGuthaben: 0 } })),
            }}
            hinweis="Steht auf dem Vorsorgeausweis («BVG-Altersguthaben» bzw. «davon obligatorisch»). Wird nur für die Schätzung des Umwandlungssatzes verwendet: 6,8% auf diesen Teil, der Durchschnittssatz auf den Rest. Ohne Angabe: Schätzung aus BVG-Mindestgutschriften."
          />
        ) : null}
        <ZahlFeld
          label={`Pensionskasse: frühester Bezug laut Reglement (${bezugsalter.reglementFruehestens}–${bezugsalter.aufschubBis})`}
          einheit="Jahre"
          value={p.pk.fruehestesAlter}
          min={bezugsalter.reglementFruehestens}
          max={bezugsalter.aufschubBis}
          nachkomma={0}
          gruppieren={false}
          onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, fruehestesAlter: Math.round(v) } }))}
          hinweis={`${barPk ? `Wegzug mit Barauszahlung gesetzt: Das Guthaben ist ab ${fmtMonat(barPk.monat)} frei${barPk.pkGesperrt > 0 ? ' (ohne den obligatorischen Teil, EU/EFTA)' : ''}; dieses Alter gilt nur für einen ordentlichen Bezug. ` : ''}Nur Pensionskasse, nicht AHV: Wert aus dem Reglement Ihrer Kasse (ohne Angabe im Reglement gesetzlich ab ${bezugsalter.gesetzlichAb}; Reglemente dürfen ab ${bezugsalter.reglementFruehestens} erlauben). Die AHV-Übergangsregel für Frauen der Jahrgänge 1961–1969 (AHV-Vorbezug ab 62) gilt für die Pensionskasse nicht. Bis zu diesem Alter bleibt das Guthaben gesperrt und verzinst sich weiter – auch wenn Sie früher aufhören zu arbeiten.`}
          warnung={
            uebergang && p.pk.fruehestesAlter === r.vorbezug.fruehestesAlterUebergangFrauen
              ? `Prüfen: ${r.vorbezug.fruehestesAlterUebergangFrauen} ist das früheste AHV-Bezugsalter für Frauen Jg. 1961–1969. Für die Pensionskasse gilt nur, was im Reglement steht (ohne Regelung ${bezugsalter.gesetzlichAb}).`
              : null
          }
        />
        {barPk ? (
          <p className="info" role="status">
            <strong>Barauszahlung bei Wegzug ab {fmtMonat(barPk.monat)}:</strong> {fmtChf(barPk.pk)} als Kapital, keine
            PK-Rente
            {barPk.pkGesperrt > 0 ? `; ${fmtChf(barPk.pkGesperrt)} (Obligatorium, Art. 25f FZG) bleiben gesperrt` : ''}.
            Das Bezugsalter laut Reglement verhindert das nicht (Details in der Karte «Wegzug ins Ausland» oben).
          </p>
        ) : wz.aktiv && !wz.barauszahlung ? (
          <p className="klein">Wegzug ohne Barauszahlung: ordentlicher Bezug ab dem Bezugsalter laut Reglement.</p>
        ) : null}
        <p className="klein">
          Der Wohnkanton beeinflusst nur die Besteuerung des Kapitalbezugs, nicht das früheste Bezugsalter. Vor 58 ist
          eine Barauszahlung nur in Ausnahmefällen möglich: endgültiger Wegzug (Karte «Wegzug ins Ausland»),
          Selbstständigkeit (nicht abgebildet).
        </p>
      </Karte>

      <Karte titel="Freizügigkeitsguthaben" untertitel="Freizügigkeitskonto oder -depot, z.B. nach Stellenwechsel">
        <div className="raster">
          <BetragFeld
            label="Guthaben heute"
            value={p.freizuegigkeit.guthaben}
            min={0}
            max={100_000_000}
            onChange={(v) => set((x) => ({ ...x, freizuegigkeit: { ...x.freizuegigkeit, guthaben: v } }))}
          />
          <ZahlFeld
            label="Verzinsung / Rendite (nominal)"
            prozent
            value={p.freizuegigkeit.zins}
            min={-0.1}
            max={0.15}
            onChange={(v) => set((x) => ({ ...x, freizuegigkeit: { ...x.freizuegigkeit, zins: v } }))}
          />
        </div>
        <p className="klein">
          Gesperrt bis frühestens 5 Jahre vor dem Referenzalter; Bezug bei Erwerbsaufgabe, spätestens im Referenzalter
          (bei Weiterarbeit bis 5 Jahre später). Kapitalbezug mit Kapitalleistungssteuer. Ausnahme: Barauszahlung bei
          endgültigem Wegzug (ausserhalb EU/EFTA bzw. ohne obligatorische Versicherung im neuen Land).
        </p>
      </Karte>

      <Karte titel="Säule 3a">
        <BetragFeld
          label="Guthaben heute"
          value={p.saeule3a.guthaben}
          min={0}
          max={10_000_000}
          onChange={(v) => set((x) => ({ ...x, saeule3a: { ...x.saeule3a, guthaben: v } }))}
        />
        <div className="raster">
          <BetragFeld
            label="Einzahlung pro Jahr"
            value={p.saeule3a.beitragJahr}
            min={0}
            max={regeln.saeule3a.maxOhnePk}
            onChange={(v) => set((x) => ({ ...x, saeule3a: { ...x.saeule3a, beitragJahr: v } }))}
            hinweis={`Maximum 2026 mit PK: ${fmtChf(regeln.saeule3a.maxMitPk)}`}
          />
          <ZahlFeld
            label="Rendite (nominal)"
            prozent
            value={p.saeule3a.rendite}
            min={-0.1}
            max={0.15}
            onChange={(v) => set((x) => ({ ...x, saeule3a: { ...x.saeule3a, rendite: v } }))}
          />
        </div>
        <p className="klein">
          Gesperrt bis frühestens 5 Jahre vor dem Referenzalter; Bezug bei Erwerbsaufgabe, spätestens im Referenzalter
          (bei Weiterarbeit bis 5 Jahre später). Ausnahme: Barauszahlung bei endgültigem Wegzug.
        </p>
      </Karte>

      <AuslandRentenKarte p={p} set={set} />
    </>
  );
}

function AuslandRentenKarte({ p, set }: { p: Person; set: (fn: (p: Person) => Person) => void }) {
  const setRente = (id: string, fn: (r: AuslandRente) => AuslandRente) =>
    set((x) => ({ ...x, auslandRenten: x.auslandRenten.map((r) => (r.id === id ? fn(r) : r)) }));
  return (
    <Karte
      titel="Ausländische Renten"
      untertitel="z.B. Rente aus Brasilien (INSS), Deutschland oder einer früheren Tätigkeit im Ausland"
    >
      {p.auslandRenten.length === 0 ? <p className="klein">Keine erfasst.</p> : null}
      {p.auslandRenten.map((r) => (
        <div key={r.id} className="unterkarte">
          <TextFeld
            label="Bezeichnung"
            value={r.bezeichnung}
            onChange={(v) => setRente(r.id, (x) => ({ ...x, bezeichnung: v }))}
          />
          <div className="raster">
            <TextFeld
              label="Land (ISO-Code)"
              value={r.land}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, land: v.toUpperCase().slice(0, 2) }))}
            />
            <AuswahlFeld
              label="Währung"
              value={r.waehrung}
              optionen={WAEHRUNGEN.map((w) => ({ value: w, label: w }))}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, waehrung: v }))}
            />
          </div>
          <div className="raster">
            <BetragFeld
              label="Betrag pro Zahlung"
              einheit={r.waehrung}
              dezimal
              value={r.betrag}
              min={0}
              max={100_000_000}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, betrag: v }))}
            />
            <ZahlFeld
              label="Zahlungen pro Jahr"
              value={r.zahlungenProJahr}
              min={1}
              max={14}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, zahlungenProJahr: Math.round(v) }))}
              hinweis="Brasilien: 13 (inkl. 13º salário)"
            />
          </div>
          <div className="raster">
            <ZahlFeld
              label={`Wechselkurs CHF je 1 ${r.waehrung}`}
              value={r.wechselkursChf}
              min={0.000001}
              max={100000}
              nachkomma={6}
              gruppieren={false}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, wechselkursChf: v }))}
              hinweis="Heutige Annahme; Entwicklung siehe Wechselkursänderung."
            />
            <ZahlFeld
              label="Beginn mit Alter"
              einheit="Jahren"
              value={r.startAlter}
              min={0}
              max={120}
              nachkomma={2}
              gruppieren={false}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, startAlter: v }))}
            />
          </div>
          <div className="raster">
            <AuswahlFeld
              label="Indexierung"
              value={r.indexierung.art}
              optionen={[
                { value: 'teuerung', label: 'Wie Teuerung (real konstant)' },
                { value: 'keine', label: 'Keine (nominal fix)' },
                { value: 'satz', label: 'Fester Satz pro Jahr' },
              ]}
              onChange={(v) =>
                setRente(r.id, (x) => ({
                  ...x,
                  indexierung:
                    v === 'satz' ? { art: 'satz', satz: 0.02 } : v === 'keine' ? { art: 'keine' } : { art: 'teuerung' },
                }))
              }
            />
            {r.indexierung.art === 'satz' ? (
              <ZahlFeld
                label="Indexierung (nominal)"
                prozent
                value={r.indexierung.satz}
                min={-0.1}
                max={0.5}
                onChange={(v) => setRente(r.id, (x) => ({ ...x, indexierung: { art: 'satz', satz: v } }))}
              />
            ) : null}
          </div>
          <div className="raster">
            <ZahlFeld
              label="Wechselkursänderung pro Jahr (real)"
              prozent
              value={r.wechselkursAenderung}
              min={-0.5}
              max={0.5}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, wechselkursAenderung: v }))}
              hinweis="Szenario: negativ = Abwertung der Fremdwährung gegenüber dem CHF (z.B. −2%)."
            />
            <ZahlFeld
              label="Steuer im Quellenstaat"
              prozent
              value={r.quellensteuerSatz}
              min={0}
              max={1}
              onChange={(v) => setRente(r.id, (x) => ({ ...x, quellensteuerSatz: v }))}
              hinweis="In % der Bruttorente, gemäss DBA. Anrechnung in der Schweiz nicht modelliert."
            />
          </div>
          <Schalter
            label="In der Schweiz als Einkommen steuerbar"
            hinweis="Gemäss Doppelbesteuerungsabkommen prüfen. Länderdaten folgen."
            checked={r.steuerbarInCh}
            onChange={(v) => setRente(r.id, (x) => ({ ...x, steuerbarInCh: v }))}
          />
          <p className="info">≈ {fmtChf(r.betrag * r.zahlungenProJahr * r.wechselkursChf)} pro Jahr (heute)</p>
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => set((x) => ({ ...x, auslandRenten: x.auslandRenten.filter((y) => y.id !== r.id) }))}
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        className="knopf knopf--sekundaer"
        onClick={() => set((x) => ({ ...x, auslandRenten: [...x.auslandRenten, neueAuslandRente()] }))}
      >
        + Ausländische Rente hinzufügen
      </button>
    </Karte>
  );
}
