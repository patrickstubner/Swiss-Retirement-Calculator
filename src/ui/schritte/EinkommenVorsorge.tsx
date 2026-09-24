import { useState } from 'react';
import {
  ahvAufschubZuschlag,
  ahvMaxVorbezugMonate,
  ahvMdjeAusRente,
  ahvRenteSkala44,
  ahvTeilrente,
  ahvVorbezugKuerzung,
  istUebergangsFrau,
  pruefeAhvVerschiebung,
} from '../../core/ahv';
import { bvgKoordinierterLohn } from '../../core/bvg';
import type { AuslandRente, Person } from '../../core/typen';
import { neueAuslandRente, WAEHRUNGEN } from '../../data/defaults';
import { AuswahlFeld, Schalter, Segmente, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtChf, fmtProzent } from '../format';
import { type SchrittProps, setzePerson } from '../kontext';

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
  const { setH, regeln } = props;
  const set = (fn: (p: Person) => Person) => setzePerson(setH, i, fn);
  const r = regeln.ahv;
  const verschiebung = p.ahv.bezugVerschiebungMonate;
  const bezugArt = verschiebung < 0 ? 'vorbezug' : verschiebung > 0 ? 'aufschub' : 'ordentlich';
  const maxVorbezug = ahvMaxVorbezugMonate(p.geburtsjahr, p.geschlecht, r);
  const fehlerVerschiebung = pruefeAhvVerschiebung(verschiebung, p.geburtsjahr, p.geschlecht, r);
  const mdje = p.ahv.modus === 'skala44' ? p.ahv.mdje : ahvMdjeAusRente(p.ahv.renteMonat, r);
  let bezugInfo = '';
  if (!fehlerVerschiebung) {
    if (verschiebung < 0)
      bezugInfo = `Kürzung ${fmtProzent(ahvVorbezugKuerzung(-verschiebung, p.geburtsjahr, p.geschlecht, mdje, r))} lebenslang`;
    if (verschiebung > 0) bezugInfo = `Zuschlag ${fmtProzent(ahvAufschubZuschlag(verschiebung, r))} lebenslang`;
  }
  const geschaetzt = ahvTeilrente(ahvRenteSkala44(p.ahv.mdje, r), p.ahv.beitragsjahre, r);
  const uebergang = istUebergangsFrau(p.geburtsjahr, p.geschlecht, r);

  return (
    <>
      <Karte titel="Erwerbseinkommen">
        <ZahlFeld
          label="Bruttolohn pro Jahr (heute)"
          einheit="CHF"
          value={p.lohn}
          min={0}
          max={10_000_000}
          nachkomma={0}
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
        <Segmente
          label="Rentenhöhe"
          value={p.ahv.modus}
          optionen={[
            { value: 'eingabe', label: 'Aus Vorausberechnung' },
            { value: 'skala44', label: 'Schätzen' },
          ]}
          onChange={(m) => set((x) => ({ ...x, ahv: { ...x.ahv, modus: m } }))}
        />
        {p.ahv.modus === 'eingabe' ? (
          <ZahlFeld
            label="Erwartete AHV-Rente pro Monat"
            einheit="CHF"
            value={p.ahv.renteMonat}
            min={0}
            max={10000}
            nachkomma={0}
            onChange={(v) => set((x) => ({ ...x, ahv: { ...x.ahv, renteMonat: v } }))}
            hinweis={`Gemäss Rentenvorausberechnung der Ausgleichskasse, in heutigen Franken, ungekürzt im Referenzalter (Einzelrente max. ${fmtChf(r.maximalrenteMonat)}). Empfohlen.`}
          />
        ) : (
          <>
            <ZahlFeld
              label="Massgebendes durchschnittliches Jahreseinkommen"
              einheit="CHF"
              value={p.ahv.mdje}
              min={0}
              max={1_000_000}
              nachkomma={0}
              onChange={(v) => set((x) => ({ ...x, ahv: { ...x.ahv, mdje: v } }))}
              hinweis={`Durchschnitt inkl. Erziehungsgutschriften. Volle Maximalrente ab ${fmtChf(r.rentenformel.mdjeMaximum)}.`}
            />
            <ZahlFeld
              label="Beitragsjahre bis zum Referenzalter"
              einheit="von 44"
              value={p.ahv.beitragsjahre}
              min={0}
              max={r.vollrenteBeitragsjahre}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => set((x) => ({ ...x, ahv: { ...x.ahv, beitragsjahre: Math.round(v) } }))}
              hinweis="Pro fehlendes Jahr ca. 1/44 weniger Rente (vereinfacht)."
            />
            <p className="info">
              Geschätzte Rente (Skala 44, Art. 34 AHVG): <strong>{fmtChf(geschaetzt)}</strong> pro Monat
            </p>
          </>
        )}
        <div className="raster">
          <AuswahlFeld
            label="Bezug"
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

      <Karte titel="Pensionskasse (2. Säule)" untertitel="Werte aus dem Vorsorgeausweis">
        <ZahlFeld
          label="Altersguthaben heute"
          einheit="CHF"
          value={p.pk.guthaben}
          min={0}
          max={100_000_000}
          nachkomma={0}
          onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, guthaben: v } }))}
        />
        <AuswahlFeld
          label="Künftige Sparbeiträge"
          value={p.pk.beitragModus}
          optionen={[
            { value: 'eingabe', label: 'Gemäss Ausweis (Betrag)' },
            { value: 'bvgMinimum', label: 'BVG-Minimum (Altersgutschrift)' },
          ]}
          onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, beitragModus: v } }))}
          hinweis={
            p.pk.beitragModus === 'bvgMinimum'
              ? `Koordinierter Lohn heute: ${fmtChf(bvgKoordinierterLohn(p.lohn, regeln.bvg))}; Gutschrift 7–18% je nach Alter.`
              : undefined
          }
        />
        {p.pk.beitragModus === 'eingabe' ? (
          <ZahlFeld
            label="Sparbeitrag pro Jahr (Arbeitnehmer + Arbeitgeber)"
            einheit="CHF"
            value={p.pk.sparbeitragJahr}
            min={0}
            max={1_000_000}
            nachkomma={0}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, sparbeitragJahr: v } }))}
          />
        ) : null}
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
            value={p.pk.umwandlungssatz}
            min={0}
            max={0.1}
            onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, umwandlungssatz: v } }))}
            hinweis={`Gemäss Ausweis. BVG-Minimum ${fmtProzent(regeln.bvg.mindestumwandlungssatz)} gilt nur fürs Obligatorium; umhüllende Kassen oft deutlich tiefer.`}
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
        <ZahlFeld
          label="Frühestes Bezugsalter gemäss Reglement"
          einheit="Jahre"
          value={p.pk.fruehestesAlter}
          min={regeln.bvg.bezugsalter.reglementFruehestens}
          max={regeln.bvg.bezugsalter.aufschubBis}
          nachkomma={0}
          gruppieren={false}
          onChange={(v) => set((x) => ({ ...x, pk: { ...x.pk, fruehestesAlter: Math.round(v) } }))}
          hinweis="Bezug bei Erwerbsaufgabe, frühestens ab diesem Alter (gesetzlich ab 58 möglich)."
        />
      </Karte>

      <Karte titel="Säule 3a">
        <ZahlFeld
          label="Guthaben heute"
          einheit="CHF"
          value={p.saeule3a.guthaben}
          min={0}
          max={10_000_000}
          nachkomma={0}
          onChange={(v) => set((x) => ({ ...x, saeule3a: { ...x.saeule3a, guthaben: v } }))}
        />
        <div className="raster">
          <ZahlFeld
            label="Einzahlung pro Jahr"
            einheit="CHF"
            value={p.saeule3a.beitragJahr}
            min={0}
            max={regeln.saeule3a.maxOhnePk}
            nachkomma={0}
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
        <p className="klein">Bezug bei Erwerbsaufgabe, frühestens 5 Jahre vor dem Referenzalter.</p>
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
            <ZahlFeld
              label="Betrag pro Zahlung"
              einheit={r.waehrung}
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
              hinweis="Annahme, wird real konstant gehalten."
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
