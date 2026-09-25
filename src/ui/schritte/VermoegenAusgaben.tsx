import { referenzPerson, startvermoegen, wohneigentumNetto } from '../../core/simulation';
import type { Haushalt, Posten, PostenKategorie } from '../../core/typen';
import { neuerPosten, neuesEreignis } from '../../data/defaults';
import { gemeindenVon, KANTON_STATUS_TEXT, KANTONE, kantonNach, kantonsModellFuer } from '../../data/kantone';
import { AusgabenPhasen, HeutigeFrankenHinweis } from '../components/AusgabenPhasen';
import { AuswahlFeld, BetragFeld, Schalter, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtChf, fmtZahl } from '../format';
import { type SchrittProps, type Setzer, setzePerson } from '../kontext';
import { VEREINFACHUNG_BOERSE, VEREINFACHUNG_WOHNEIGENTUM } from '../texte';

export function VermoegenAusgaben({ h, setH, regeln, heute }: SchrittProps) {
  const ehepaar = h.zivilstand === 'verheiratet';
  return (
    <>
      {h.personen.map((p, i) => (
        <Karte key={`vermoegen-${i === 0 ? 'a' : 'b'}`} titel={`Vermögen ${p.name || `Person ${i + 1}`}`}>
          <p className="klein">
            Verfügbar – wird bei Bedarf in dieser Reihenfolge verwendet: Bargeld → Wertschriften → Sonstiges →
            Wohneigentum (zuletzt). Pensionskasse, Freizügigkeit und 3a erfassen Sie im Schritt «Vorsorge».
          </p>
          <div className="raster">
            <BetragFeld
              label="Bargeld / Konten"
              value={p.bargeld}
              min={0}
              max={1_000_000_000}
              onChange={(v) => setzePerson(setH, i, (x) => ({ ...x, bargeld: v }))}
              hinweis="Rendite gemäss «Zins Bargeld» (Annahmen)."
            />
            <BetragFeld
              label="Wertschriften (Börse)"
              value={p.wertschriften}
              min={0}
              max={1_000_000_000}
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
            <BetragFeld
              label="Wert"
              value={p.sonstiges.wert}
              min={0}
              max={1_000_000_000}
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
                <BetragFeld
                  label="Verkehrswert"
                  value={p.wohneigentum.verkehrswert}
                  min={0}
                  max={1_000_000_000}
                  onChange={(v) =>
                    setzePerson(setH, i, (x) => ({ ...x, wohneigentum: { ...x.wohneigentum, verkehrswert: v } }))
                  }
                />
                <BetragFeld
                  label="Hypothek (optional)"
                  value={p.wohneigentum.hypothek}
                  min={0}
                  max={1_000_000_000}
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
      <Karte titel="Ausgaben" untertitel="Lebenshaltung des Haushalts, ohne Steuern und AHV-Beiträge">
        <HeutigeFrankenHinweis betrag={h.ausgaben.lebenshaltung} heute={heute} inflation={h.annahmen.inflation} />
        <BetragFeld
          label="Lebenshaltungskosten pro Jahr (heute)"
          value={h.ausgaben.lebenshaltung}
          min={0}
          max={100_000_000}
          onChange={(v) => setH((x) => ({ ...x, ausgaben: { ...x.ausgaben, lebenshaltung: v } }))}
          hinweis={`Grundbetrag: gilt in allen Jahren ohne Phase oder Einzeljahr. Ohne Steuern und AHV-Beiträge (werden berechnet). Zum Vergleich: EL-Lebensbedarf ${fmtChf(
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
            hinweis="in % des Grundbetrags"
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
        {ehepaar ? <p className="klein">Die Faktoren ab 75/85 beziehen sich auf die jüngere Person.</p> : null}
        <AusgabenPhasen h={h} setH={setH} heute={heute} refIdx={referenzPerson(h.personen)} />
      </Karte>
      <PostenKarte h={h} setH={setH} />
      <EreignisKarte h={h} setH={setH} />
      <SteuerKarte h={h} setH={setH} />
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
      untertitel="Wiederkehrend pro Jahr, mit Start- und Endalter (z.B. Mieteinnahmen, Krankenkasse, Wohnkosten). Standard: heutige Franken, mit der Teuerung hochgerechnet"
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
            <BetragFeld
              label="Betrag pro Jahr (heute)"
              value={po.betragJahr}
              min={0}
              max={100_000_000}
              onChange={(v) => setP(po.id, (x) => ({ ...x, betragJahr: v }))}
              hinweis={
                po.indexierung.art === 'teuerung'
                  ? 'In heutigen Franken; wächst mit der Teuerung (Kaufkraft bleibt gleich).'
                  : po.indexierung.art === 'keine'
                    ? 'Nominaler Betrag, bleibt in Franken fix – verliert mit der Teuerung an Kaufkraft.'
                    : 'Heutiger Betrag; wächst nominal um den festen Satz pro Jahr.'
              }
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
                { value: 'teuerung', label: 'Wie Teuerung (heutige Franken)' },
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
            <BetragFeld
              label="Betrag (heute, + Zufluss / − Abfluss)"
              hinweis="In heutigen Franken; die App rechnet ihn mit der Teuerung auf das Jahr des Ereignisses hoch."
              value={ev.betrag}
              min={-1_000_000_000}
              max={1_000_000_000}
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

function SteuerKarte({ h, setH }: { h: Haushalt; setH: Setzer }) {
  const st = h.steuern;
  const kanton = kantonNach(st.kanton);
  const setS = (patch: Partial<Haushalt['steuern']>) => setH((x) => ({ ...x, steuern: { ...x.steuern, ...patch } }));
  const gemeinden = kanton ? gemeindenVon(kanton.code) : [];
  const modell = kantonsModellFuer(st);
  const beispiel = st.kanton && !st.eigeneSaetze ? modell : null;
  const zs = h.zivilstand === 'verheiratet' ? 'verheiratet' : 'alleinstehend';
  return (
    <Karte
      titel="Kantons- und Gemeindesteuern"
      untertitel="Direkte Bundessteuer exakt nach Tarif 2026. Kanton und Gemeinde gemäss Kantonsdaten 2026."
    >
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
        <p className="warnung">
          Ohne Kantonswahl werden nur die unten eingegebenen effektiven Sätze verwendet (Standard 0).
        </p>
      )}
      {kanton && !st.eigeneSaetze && gemeinden.length > 0 ? (
        <div className="raster">
          <AuswahlFeld
            label="Gemeinde"
            value={st.gemeinde || kanton.hauptort}
            optionen={gemeinden.map((g) => ({ value: g, label: g }))}
            onChange={(v) => setS({ gemeinde: v })}
          />
          <AuswahlFeld
            label="Kirchensteuer"
            value={st.kirche}
            optionen={[
              { value: 'keine', label: 'Keine' },
              { value: 'reformiert', label: 'Reformiert' },
              { value: 'katholisch', label: 'Römisch-katholisch' },
              { value: 'christkatholisch', label: 'Christkatholisch' },
            ]}
            onChange={(v) => setS({ kirche: v })}
          />
        </div>
      ) : null}
      {kanton && !st.eigeneSaetze && kanton.status === 'naeherung' ? (
        <p className="klein">
          Näherung: Einkommens- und Vermögenssteuer werden aus effektiven Sätzen für den Hauptort {kanton.hauptort}{' '}
          interpoliert (ESTV-Steuerrechner 2026), ohne Kirchensteuer und ohne kantonale Abzüge. Kapitalleistungen:
          effektive Referenzsätze (Hauptort). Regel gemäss Kantonsblatt: {kanton.kapitalMethode}. Exakte Tarife und
          Gemeinden folgen.
        </p>
      ) : null}
      {beispiel ? (
        <p className="info">
          {beispiel.beschreibung}. Beispiel {zs === 'verheiratet' ? 'Ehepaar' : 'Einzelperson'}: steuerbares Einkommen
          {fmtZahl(100000)} → {fmtChf(beispiel.einkommenssteuer(100000, zs))}; Kapitalbezug {fmtZahl(500000)} →{' '}
          {fmtChf(beispiel.kapitalleistungssteuer(500000, zs))} (Kanton + Gemeinde
          {st.kirche !== 'keine' && kanton?.status === 'exakt' ? ' + Kirche' : ''}, ohne Bund).
        </p>
      ) : null}
      {kanton ? (
        <Schalter
          label="Eigene effektive Sätze verwenden"
          hinweis="z.B. aus dem ESTV-Steuerrechner, wenn Sie Ihre Abzüge genauer abbilden möchten."
          checked={st.eigeneSaetze}
          onChange={(v) => setS({ eigeneSaetze: v })}
        />
      ) : null}
      {!kanton || st.eigeneSaetze ? (
        <>
          <ZahlFeld
            label="Effektiver Einkommenssteuersatz Kanton + Gemeinde"
            prozent
            value={st.einkommenSatz}
            min={0}
            max={0.5}
            onChange={(v) => setS({ einkommenSatz: v })}
          />
          <div className="raster">
            <ZahlFeld
              label="Vermögenssteuer"
              einheit="‰"
              value={st.vermoegenPromille}
              min={0}
              max={20}
              onChange={(v) => setS({ vermoegenPromille: v })}
            />
            <ZahlFeld
              label="Kapitalbezugssteuer Kanton"
              prozent
              value={st.kapitalSatz}
              min={0}
              max={0.3}
              onChange={(v) => setS({ kapitalSatz: v })}
            />
          </div>
        </>
      ) : null}
      <p className="klein">
        Vergleich und eigene Sätze:{' '}
        <a href="https://swisstaxcalculator.estv.admin.ch/" target="_blank" rel="noreferrer noopener">
          Steuerrechner der ESTV
        </a>
        . Steuerbares Einkommen vereinfacht (ohne kantonale Abzüge).
      </p>
    </Karte>
  );
}
