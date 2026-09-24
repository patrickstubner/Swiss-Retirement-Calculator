import { startvermoegen, wohneigentumNetto } from '../../core/simulation';
import { KANTON_STATUS_TEXT, KANTONE, kantonNach } from '../../data/kantone';
import { AuswahlFeld, Schalter, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtChf } from '../format';
import { type SchrittProps, setzePerson } from '../kontext';
import { VEREINFACHUNG_BOERSE, VEREINFACHUNG_WOHNEIGENTUM } from '../texte';

export function VermoegenAusgaben({ h, setH, regeln }: SchrittProps) {
  const ehepaar = h.zivilstand === 'verheiratet';
  const kanton = kantonNach(h.steuern.kanton);
  return (
    <>
      {h.personen.map((p, i) => (
        <Karte key={`vermoegen-${i === 0 ? 'a' : 'b'}`} titel={`Vermögen ${p.name || `Person ${i + 1}`}`}>
          <ZahlFeld
            label="Vermögen heute (Wertschriften, Konten)"
            einheit="CHF"
            value={p.vermoegen}
            min={0}
            max={1_000_000_000}
            nachkomma={0}
            onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, vermoegen: v }))}
            hinweis="Ohne Pensionskasse und Säule 3a (werden separat erfasst)."
          />
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
        Gesamtes Anlagevermögen heute: <strong>{fmtChf(startvermoegen(h))}</strong>. {VEREINFACHUNG_BOERSE}
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
