import { startvermoegen, wohneigentumNetto } from '../../core/simulation';
import type { Haushalt, Posten, PostenKategorie } from '../../core/typen';
import { neuerPosten, neuesEreignis } from '../../data/defaults';
import { KANTON_STATUS_TEXT, KANTONE, kantonNach } from '../../data/kantone';
import { AuswahlFeld, Schalter, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtChf } from '../format';
import { type SchrittProps, type Setzer, setzePerson } from '../kontext';
import { VEREINFACHUNG_BOERSE, VEREINFACHUNG_WOHNEIGENTUM } from '../texte';

export function VermoegenAusgaben({ h, setH, regeln }: SchrittProps) {
  const ehepaar = h.zivilstand === 'verheiratet';
  const kanton = kantonNach(h.steuern.kanton);
  return (
    <>
      {h.personen.map((p, i) => (
        <Karte key={`vermoegen-${i === 0 ? 'a' : 'b'}`} titel={`Vermögen ${p.name || `Person ${i + 1}`}`}>
          <p className="klein">
            Verfügbar – wird bei Bedarf in dieser Reihenfolge verwendet: Bargeld → Wertschriften → Sonstiges →
            Wohneigentum (zuletzt). Pensionskasse, Freizügigkeit und 3a erfassen Sie im Schritt «Vorsorge».
          </p>
          <div className="raster">
            <ZahlFeld
              label="Bargeld / Konten"
              einheit="CHF"
              value={p.bargeld}
              min={0}
              max={1_000_000_000}
              nachkomma={0}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, bargeld: v }))}
              hinweis="Rendite gemäss «Zins Bargeld» (Annahmen)."
            />
            <ZahlFeld
              label="Wertschriften (Börse)"
              einheit="CHF"
              value={p.wertschriften}
              min={0}
              max={1_000_000_000}
              nachkomma={0}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, wertschriften: v }))}
              hinweis="Aktien, Fonds, ETF. Rendite gemäss «Rendite Börse»."
            />
          </div>
          <div className="raster">
            <TextFeld
              label="Sonstiges Vermögen (Bezeichnung)"
              value={p.sonstiges.bezeichnung}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, sonstiges: { ...x.sonstiges, bezeichnung: v } }))}
            />
            <ZahlFeld
              label="Wert"
              einheit="CHF"
              value={p.sonstiges.wert}
              min={0}
              max={1_000_000_000}
              nachkomma={0}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, sonstiges: { ...x.sonstiges, wert: v } }))}
            />
            <ZahlFeld
              label="Rendite (nominal)"
              prozent
              value={p.sonstiges.rendite}
              min={-0.2}
              max={0.3}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, sonstiges: { ...x.sonstiges, rendite: v } }))}
              hinweis="z.B. Darlehen, Gold, Beteiligung"
            />
          </div>
          <Schalter
            label="Wohneigentum"
            checked={p.wohneigentum.vorhanden}
            onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, wohneigentum: { ...x.wohneigentum, vorhanden: v } }))}
          />
          {p.wohneigentum.vorhanden ? (
            <>
              <div className="raster">
                <ZahlFeld
                  label="Verkehrswert"
                  einheit="CHF"
                  value={p.wohneigentum.verkehrswert}
                  min={0}
                  max={1_000_000_000}
                  nachkomma={0}
                  onChange={(v) =>
                    setzePerson(setH, i, (x) => ({ ...x, wohneigentum: { ...x.wohneigentum, verkehrswert: v } }))
                  }
                />
                <ZahlFeld
                  label="Hypothek (optional)"
                  einheit="CHF"
                  value={p.wohneigentum.hypothek}
                  min={0}
                  max={1_000_000_000}
                  nachkomma={0}
                  onChange={(v) =>
                    setzePerson(setH, i, (x) => ({ ...x, wohneigentum: { ...x.wohneigentum, hypothek: v } }))
                  }
                />
              </div>
              <p className="info">
                Nettowert: <strong>{fmtChf(wohneigentumNetto(p))}</strong>. {VEREINFACHUNG_WOHNEIGENTUM}
              </p>
            </>
          ) : null}
        </Karte>
      ))}
      <p className="info">
        Verfügbares Vermögen heute (inkl. Wohneigentum netto): <strong>{fmtChf(startvermoegen(h))}</strong>.{' '}
        {VEREINFACHUNG_BOERSE}
      </p>
      <Karte titel="Ausgaben">
        <ZahlFeld
          label="Lebenshaltungskosten pro Jahr (heute)"
          einheit="CHF"
          value={h.ausgaben.lebenshaltung}
          min={0}
          max={100_000_000}
          nachkomma={0}
          onChange={(v) => setH((x) => ({ ...x, ausgaben: { ...x.ausgaben, lebenshaltung: v } }))}
          hinweis={`Ohne Steuern und AHV-Beiträge (werden berechnet). Zum Vergleich: EL-Lebensbedarf ${fmtChf(
            ehepaar ? regeln.ahv.elLebensbedarf.ehepaar : regeln.ahv.elLebensbedarf.alleinstehend,
          )}.`}
        />
        <div className="raster">
          <ZahlFeld
            label="Ausgaben ab 75"
            prozent
            nachkomma={0}
            value={h.ausgaben.faktorAb75}
            min={0}
            max={3}
            onChange={(v) => setH((x) => ({ ...x, ausgaben: { ...x.ausgaben, faktorAb75: v } }))}
            hinweis="in % der heutigen Ausgaben"
          />
          <ZahlFeld
            label="Ausgaben ab 85"
            prozent
            nachkomma={0}
            value={h.ausgaben.faktorAb85}
            min={0}
            max={5}
            onChange={(v) => setH((x) => ({ ...x, ausgaben: { ...x.ausgaben, faktorAb85: v } }))}
            hinweis="z.B. höher für Pflege"
          />
        </div>
        {ehepaar ? <p className="klein">Altersphasen beziehen sich auf die jüngere Person.</p> : null}
      </Karte>
      <PostenKarte h={h} setH={setH} />
      <EreignisKarte h={h} setH={setH} />
      <Karte
        titel="Kantons- und Gemeindesteuern"
        untertitel="Bundessteuer exakt nach Tarif 2026. Kanton und Gemeinde vorläufig über effektive Sätze; exakte Tarife (zuerst ZH und AG) folgen."
      >
        <AuswahlFeld
          label="Wohnkanton"
          value={kanton?.code ?? ''}
          optionen={[
            { value: '', label: 'Bitte wählen' },
            ...KANTONE.map((k) => ({ value: k.code, label: `${k.name} (${k.code})` })),
          ]}
          onChange={(v) => setH((x) => ({ ...x, steuern: { ...x.steuern, kanton: v } }))}
        />
        <p className={`badge badge--${kanton?.status ?? 'naeherung'}`} role="status">
          {KANTON_STATUS_TEXT[kanton?.status ?? 'naeherung']}
        </p>
        <ZahlFeld
          label="Effektiver Einkommenssteuersatz Kanton + Gemeinde"
          prozent
          value={h.steuern.einkommenSatz}
          min={0}
          max={0.5}
          onChange={(v) => setH((x) => ({ ...x, steuern: { ...x.steuern, einkommenSatz: v } }))}
        />
        <div className="raster">
          <ZahlFeld
            label="Vermögenssteuer"
            einheit="‰"
            value={h.steuern.vermoegenPromille}
            min={0}
            max={20}
            onChange={(v) => setH((x) => ({ ...x, steuern: { ...x.steuern, vermoegenPromille: v } }))}
          />
          <ZahlFeld
            label="Kapitalbezugssteuer Kanton"
            prozent
            value={h.steuern.kapitalSatz}
            min={0}
            max={0.3}
            onChange={(v) => setH((x) => ({ ...x, steuern: { ...x.steuern, kapitalSatz: v } }))}
          />
        </div>
        <p className="klein">
          Sätze ermitteln z.B. mit dem{' '}
          <a href="https://swisstaxcalculator.estv.admin.ch/" target="_blank" rel="noreferrer noopener">
            Steuerrechner der ESTV
          </a>
          . Die direkte Bundessteuer wird exakt nach Tarif 2026 berechnet.
        </p>
      </Karte>
    </>
  );
}

const KATEGORIEN: Record<'einnahme' | 'ausgabe', { value: PostenKategorie; label: string }[]> = {
  einnahme: [
    { value: 'mieteinnahmen', label: 'Mieteinnahmen' },
    { value: 'sonstigeEinnahme', label: 'Sonstige Einnahme' },
  ],
  ausgabe: [
    { value: 'wohnen', label: 'Wohnen (Miete, Nebenkosten, Unterhalt)' },
    { value: 'gesundheit', label: 'Gesundheit (Krankenkasse u.a.)' },
    { value: 'sonstigeAusgabe', label: 'Sonstige Ausgabe' },
  ],
};

function personOptionen(h: Haushalt) {
  return h.personen.map((p, i) => ({ value: String(i), label: `Alter von ${p.name || `Person ${i + 1}`}` }));
}

function PostenKarte({ h, setH }: { h: Haushalt; setH: Setzer }) {
  const setP = (id: string, fn: (p: Posten) => Posten) =>
    setH((x) => ({ ...x, posten: x.posten.map((p) => (p.id === id ? fn(p) : p)) }));
  return (
    <Karte
      titel="Weitere Einnahmen und Ausgaben"
      untertitel="Wiederkehrend pro Jahr, mit Start- und Endalter (z.B. Mieteinnahmen, Krankenkasse, Wohnkosten)"
    >
      {h.posten.length === 0 ? <p className="klein">Keine erfasst.</p> : null}
      {h.posten.map((po) => (
        <div key={po.id} className={`unterkarte unterkarte--${po.art}`}>
          <div className="raster">
            <TextFeld
              label="Bezeichnung"
              value={po.bezeichnung}
              onChange={(v) => setP(po.id, (x) => ({ ...x, bezeichnung: v }))}
            />
            <AuswahlFeld
              label={po.art === 'einnahme' ? 'Einnahme – Kategorie' : 'Ausgabe – Kategorie'}
              value={po.kategorie}
              optionen={KATEGORIEN[po.art]}
              onChange={(v) => setP(po.id, (x) => ({ ...x, kategorie: v }))}
            />
          </div>
          <div className="raster">
            <ZahlFeld
              label="Betrag pro Jahr (heute)"
              einheit="CHF"
              value={po.betragJahr}
              min={0}
              max={100_000_000}
              nachkomma={0}
              onChange={(v) => setP(po.id, (x) => ({ ...x, betragJahr: v }))}
            />
            {h.personen.length > 1 ? (
              <AuswahlFeld
                label="Bezug"
                value={String(po.person)}
                optionen={personOptionen(h)}
                onChange={(v) => setP(po.id, (x) => ({ ...x, person: Number(v) }))}
              />
            ) : null}
          </div>
          <div className="raster">
            <ZahlFeld
              label="Ab Alter"
              einheit="Jahren"
              value={po.startAlter}
              min={0}
              max={999}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setP(po.id, (x) => ({ ...x, startAlter: Math.round(v) }))}
              hinweis="Leer = ab sofort"
            />
            <ZahlFeld
              label="Bis Alter (ohne)"
              einheit="Jahren"
              value={po.endAlter ?? 0}
              min={0}
              max={999}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setP(po.id, (x) => ({ ...x, endAlter: v > 0 ? Math.round(v) : null }))}
              hinweis="Leer = lebenslang"
            />
          </div>
          <div className="raster">
            <AuswahlFeld
              label="Indexierung"
              value={po.indexierung.art}
              optionen={[
                { value: 'teuerung', label: 'Wie Teuerung (real konstant)' },
                { value: 'keine', label: 'Keine (nominal fix)' },
                { value: 'satz', label: 'Fester Satz pro Jahr' },
              ]}
              onChange={(v) =>
                setP(po.id, (x) => ({
                  ...x,
                  indexierung:
                    v === 'satz' ? { art: 'satz', satz: 0 } : v === 'keine' ? { art: 'keine' } : { art: 'teuerung' },
                }))
              }
            />
            {po.indexierung.art === 'satz' ? (
              <ZahlFeld
                label="Indexierung (nominal)"
                prozent
                value={po.indexierung.satz}
                min={-0.1}
                max={0.5}
                onChange={(v) => setP(po.id, (x) => ({ ...x, indexierung: { art: 'satz', satz: v } }))}
              />
            ) : null}
          </div>
          {po.art === 'einnahme' ? (
            <Schalter
              label="Als Einkommen steuerbar"
              checked={po.steuerbar}
              onChange={(v) => setP(po.id, (x) => ({ ...x, steuerbar: v }))}
            />
          ) : null}
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => setH((x) => ({ ...x, posten: x.posten.filter((y) => y.id !== po.id) }))}
          >
            Entfernen
          </button>
        </div>
      ))}
      <div className="knopfreihe">
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => setH((x) => ({ ...x, posten: [...x.posten, neuerPosten('einnahme')] }))}
        >
          + Einnahme
        </button>
        <button
          type="button"
          className="knopf knopf--sekundaer"
          onClick={() => setH((x) => ({ ...x, posten: [...x.posten, neuerPosten('ausgabe')] }))}
        >
          + Ausgabe
        </button>
      </div>
    </Karte>
  );
}

function EreignisKarte({ h, setH }: { h: Haushalt; setH: Setzer }) {
  const setE = (id: string, fn: (e: Haushalt['ereignisse'][number]) => Haushalt['ereignisse'][number]) =>
    setH((x) => ({ ...x, ereignisse: x.ereignisse.map((e) => (e.id === id ? fn(e) : e)) }));
  return (
    <Karte titel="Einmalige Ereignisse" untertitel="z.B. Erbschaft (+), Schenkung, Autokauf oder Renovation (−)">
      {h.ereignisse.length === 0 ? <p className="klein">Keine erfasst.</p> : null}
      {h.ereignisse.map((ev) => (
        <div key={ev.id} className="unterkarte">
          <TextFeld
            label="Bezeichnung"
            value={ev.bezeichnung}
            onChange={(v) => setE(ev.id, (x) => ({ ...x, bezeichnung: v }))}
          />
          <div className="raster">
            <ZahlFeld
              label="Betrag (heute, + Zufluss / − Abfluss)"
              einheit="CHF"
              value={ev.betrag}
              min={-1_000_000_000}
              max={1_000_000_000}
              nachkomma={0}
              onChange={(v) => setE(ev.id, (x) => ({ ...x, betrag: v }))}
            />
            <ZahlFeld
              label="Im Alter von"
              einheit="Jahren"
              value={ev.alter}
              min={0}
              max={999}
              nachkomma={0}
              gruppieren={false}
              onChange={(v) => setE(ev.id, (x) => ({ ...x, alter: Math.round(v) }))}
            />
          </div>
          {h.personen.length > 1 ? (
            <AuswahlFeld
              label="Bezug / Empfänger"
              value={String(ev.person)}
              optionen={personOptionen(h)}
              onChange={(v) => setE(ev.id, (x) => ({ ...x, person: Number(v) }))}
            />
          ) : null}
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => setH((x) => ({ ...x, ereignisse: x.ereignisse.filter((y) => y.id !== ev.id) }))}
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        className="knopf knopf--sekundaer"
        onClick={() => setH((x) => ({ ...x, ereignisse: [...x.ereignisse, neuesEreignis()] }))}
      >
        + Ereignis hinzufügen
      </button>
    </Karte>
  );
}
