/**
 * Karte «Kapitalbezug in den 26 Kantonen»: Steuer auf eine Kapitalleistung aus PK, Freizügigkeit und 3a
 * (a) bei Wohnsitz in der Schweiz (Wohnkanton zählt, nicht der Sitz der Einrichtung) und
 * (b) als Quellensteuer bei Wohnsitz im Ausland (Sitz der Einrichtung zählt), plus Strategiekarte
 * «Freizügigkeit in einen Tiefsteuerkanton» (ZG, SZ, NW).
 */
import { useMemo, useState } from 'react';
import {
  freizuegigkeitStrategie,
  kantonsVergleich,
  kapitalSteuerWohnsitz,
  sortiert,
  type VergleichFall,
} from '../../core/kantonsVergleich';
import type { Haushalt } from '../../core/typen';
import { KANTONE, kantonNach } from '../../data/kantone';
import type { Regeln } from '../../rules';
import { fmtChf, fmtProzent } from '../format';
import { KANTONS_QUELLEN, VERGLEICH_BETRAG_MAX, VERGLEICH_BETRAG_STANDARD, vorschlagBetrag } from '../kantonsVergleich';
import { AuswahlFeld, BetragFeld, Segmente } from './Felder';
import { Karte } from './Karte';

const name = (code: string) => kantonNach(code)?.name ?? code;

export function KantoneKarte({ h, regeln }: { h: Haushalt; regeln: Regeln }) {
  const [betrag, setBetrag] = useState(VERGLEICH_BETRAG_STANDARD);
  const [fall, setFall] = useState<VergleichFall>('wohnsitz');
  const [bisher, setBisher] = useState('');
  const zs = h.zivilstand === 'verheiratet' ? 'verheiratet' : 'alleinstehend';
  const wohn = h.steuern.kanton;
  const b = Math.min(Math.max(0, betrag), VERGLEICH_BETRAG_MAX);
  const zeilen = useMemo(
    () => sortiert(kantonsVergleich(b, zs, regeln, h.steuern), fall),
    [b, zs, regeln, h.steuern, fall],
  );
  const strategie = useMemo(
    () => freizuegigkeitStrategie(b, zs, regeln, h.steuern, wohn, bisher),
    [b, zs, regeln, h.steuern, wohn, bisher],
  );
  const kontrolle = useMemo(() => {
    const ai = kapitalSteuerWohnsitz('AI', 1_000_000, 'alleinstehend', regeln, h.steuern);
    const zh = kapitalSteuerWohnsitz('ZH', 1_000_000, 'alleinstehend', regeln, h.steuern);
    return { ai, zh };
  }, [regeln, h.steuern]);
  const markiert = fall === 'wohnsitz' ? wohn : bisher || wohn;
  const guenstigster = zeilen[0];
  const eigene = zeilen.find((z) => z.code === markiert);
  const wert = (z: (typeof zeilen)[number]) => (fall === 'wohnsitz' ? z.wohnsitz : z.quelle);

  return (
    <Karte
      titel="Kapitalbezug in den 26 Kantonen"
      untertitel="Steuer auf eine Kapitalleistung aus Pensionskasse, Freizügigkeit oder 3a – im Vergleich aller Kantone"
    >
      <BetragFeld
        label="Kapitalleistung (Summe aller Bezüge eines Kalenderjahres)"
        value={betrag}
        max={VERGLEICH_BETRAG_MAX}
        onChange={setBetrag}
        hinweis={
          zs === 'verheiratet'
            ? 'Bei Ehepaaren werden die Bezüge beider Personen im selben Jahr zusammengerechnet (Verheiratetentarif).'
            : undefined
        }
      />
      <button type="button" className="link-knopf" onClick={() => setBetrag(vorschlagBetrag(h))}>
        Summe meiner erfassten Guthaben (PK, Freizügigkeit, 3a) einsetzen
      </button>
      <Segmente
        label="Fall"
        value={fall}
        optionen={[
          { value: 'wohnsitz', label: 'Wohnsitz in der Schweiz' },
          { value: 'quelle', label: 'Wohnsitz im Ausland (Quellensteuer)' },
        ]}
        onChange={setFall}
      />
      {fall === 'wohnsitz' ? (
        <p className="info">
          <strong>Es zählt der Wohnkanton bei Fälligkeit, nicht der Sitz der Vorsorgeeinrichtung.</strong> Die Steuer
          wird separat vom übrigen Einkommen als volle Jahressteuer erhoben (Art. 4b Abs. 1, Art. 11 Abs. 3 StHG), dazu
          kommt die direkte Bundessteuer zu einem Fünftel des Tarifs (Art. 38 DBG). Ein Stiftungssitz in Zug oder Schwyz
          senkt die Steuer eines Zürchers nicht.
        </p>
      ) : (
        <p className="info">
          <strong>Es zählt der Sitz der auszahlenden Einrichtung.</strong> Wer bei Auszahlung im Ausland wohnt, wird an
          der Quelle besteuert: Bund (QStV) plus Tarif des Sitzkantons (Art. 4 Abs. 2 lit. e, Art. 35 Abs. 1 lit. g
          StHG; Art. 96 DBG). Der Abzug erfolgt immer; ob und wie viel zurückerstattet wird, regelt das
          Doppelbesteuerungsabkommen mit dem Wohnsitzstaat (Antrag innert 3 Jahren, Rechner: «Steuern nach dem Wegzug»).
          Vor dem Wegzug ausbezahlte Beträge werden im Wohnkanton besteuert.
        </p>
      )}

      {eigene && guenstigster ? (
        <p className="info" role="status">
          {name(markiert)}: <strong>{fmtChf(wert(eigene).total)}</strong> ({fmtProzent(wert(eigene).satz * 100, 2)}) auf{' '}
          {fmtChf(b)}.{' '}
          {guenstigster.code === markiert
            ? 'Das ist der tiefste Wert aller Kantone.'
            : `Am günstigsten: ${name(guenstigster.code)} mit ${fmtChf(wert(guenstigster).total)} (Unterschied ${fmtChf(wert(eigene).total - wert(guenstigster).total)}).`}
        </p>
      ) : (
        <p className="warnung">Bitte den Wohnkanton wählen, damit Ihr Kanton in der Liste hervorgehoben wird.</p>
      )}

      <div className="tabelle-scroll">
        <table className="vergleich-tabelle kantons-tabelle">
          <caption>
            {fall === 'wohnsitz'
              ? `Steuer auf ${fmtChf(b)} bei Wohnsitz im Kanton (Hauptort, ohne Kirchensteuer, ${zs === 'verheiratet' ? 'verheiratet' : 'alleinstehend'})`
              : `Quellensteuer auf ${fmtChf(b)} nach Sitz der Einrichtung (vor einer DBA-Rückerstattung, ${zs === 'verheiratet' ? 'verheiratet' : 'alleinstehend'})`}
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Kanton</th>
              <th scope="col">Kanton{fall === 'wohnsitz' ? ' + Gemeinde' : ''}</th>
              <th scope="col">Bund</th>
              <th scope="col">Total</th>
              <th scope="col">Satz</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => {
              const w = wert(z);
              const eigen = z.code === markiert;
              return (
                <tr
                  key={z.code}
                  className={eigen ? 'kanton-eigen' : undefined}
                  aria-current={eigen ? 'true' : undefined}
                >
                  <td>{i + 1}</td>
                  <th scope="row">
                    {name(z.code)} ({z.code}){eigen ? ' ◀' : ''}
                    {fall === 'quelle' && z.quelle.naeherung ? ' *' : ''}
                  </th>
                  <td>{fmtChf(w.kanton)}</td>
                  <td>{fmtChf(w.bund)}</td>
                  <td>
                    <strong>{fmtChf(w.total)}</strong>
                  </td>
                  <td>{fmtProzent(w.satz * 100, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="klein">
        {fall === 'wohnsitz'
          ? 'Kantonswerte aus dem ESTV-Steuerrechner 2026 (Kantonshauptort, ohne Kirchensteuer; Stützpunkte, dazwischen linear interpoliert; ZH und AG mit exakten Tarifen). Die Gemeinde und die Kirchensteuer verändern den Wert: z.B. Zürich mit reformierter Kirchensteuer ca. 4 % höher. ◀ = Ihr Wohnkanton.'
          : 'Kantonstarife laut ESTV-Übersicht «Quellensteuersätze für Vorsorgeleistungen» 2026 (Bund nach QStV Anhang Ziff. 3). Kantone mit Tarifdatei (AG, BL, GE, JU, NE, SO, VS, VD): Satz auf dem ganzen Betrag inkl. Bundesteil. ◀ = bisheriger Sitz (unten wählbar).'}
      </p>

      <details>
        <summary>Plausibilitätsprüfung</summary>
        <p className="klein">
          Bei {fmtChf(1_000_000)} und Wohnsitz alleinstehend ergibt dieselbe Rechnung für Appenzell Innerrhoden{' '}
          {fmtChf(kontrolle.ai.total)} (Kanton/Gemeinde {fmtChf(kontrolle.ai.kanton)} + Bund {fmtChf(kontrolle.ai.bund)}
          ) und für Zürich (Stadt, ohne Kirche) {fmtChf(kontrolle.zh.total)} ({fmtChf(kontrolle.zh.kanton)} +{' '}
          {fmtChf(kontrolle.zh.bund)}). Mit reformierter Kirchensteuer liegt Zürich bei ca. CHF 113'600; verheiratet ist
          die Steuer in Zürich deutlich tiefer (Splitting). Diese Werte sind ESTV-Rechnerwerte 2026 und keine Richtwerte
          aus Faustregeln; Abweichungen zu Ihren eigenen Schätzungen entstehen durch Kirchensteuer, Gemeinde, Zivilstand
          und Betragshöhe.
        </p>
      </details>

      <h3 className="unter-titel">Strategie: Freizügigkeit in einen Tiefsteuerkanton</h3>
      <p className="klein">
        Idee: Das Freizügigkeitsguthaben liegt bei einer Einrichtung mit Sitz in Zug, Schwyz oder Nidwalden. Was das
        bringt, hängt davon ab, wo Sie bei der Auszahlung wohnen:
      </p>
      <AuswahlFeld
        label="Bisheriger Sitz der Freizügigkeits-/Vorsorgeeinrichtung"
        value={bisher}
        optionen={[
          { value: '', label: `Wie Wohnkanton${kantonNach(wohn) ? ` (${wohn})` : ''}` },
          ...KANTONE.map((k) => ({ value: k.code, label: `${k.name} (${k.code})` })),
        ]}
        onChange={setBisher}
      />
      <div className="tabelle-scroll">
        <table className="vergleich-tabelle kantons-tabelle">
          <caption>Wirkung eines Sitzes in ZG, SZ oder NW auf {fmtChf(b)}</caption>
          <thead>
            <tr>
              <th scope="col">Neuer Sitz</th>
              <th scope="col">Bleiben Sie in der Schweiz</th>
              <th scope="col">Bezug nach Wegzug (Quellensteuer)</th>
            </tr>
          </thead>
          <tbody>
            {strategie.map((s) => (
              <tr key={s.sitz}>
                <th scope="row">
                  {name(s.sitz)} ({s.sitz})
                </th>
                <td>
                  Steuer {fmtChf(s.bleibtInCh.steuer)}
                  <br />
                  <strong>Ersparnis {fmtChf(0)}</strong>
                </td>
                <td>
                  Quellensteuer {fmtChf(s.nachWegzug.steuer)}
                  <br />
                  <strong>
                    {s.nachWegzug.ersparnis >= 0 ? 'Ersparnis ' : 'Mehrkosten '}
                    {fmtChf(Math.abs(s.nachWegzug.ersparnis))}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="liste klein">
        <li>
          <strong>Bleiben Sie in der Schweiz wohnen: kein Vorteil.</strong> Massgebend ist Ihr Wohnkanton bei Fälligkeit
          (Art. 4b Abs. 1 StHG). Ein Wechsel der Einrichtung ändert die Steuer nicht.
        </li>
        <li>
          <strong>Bezug nach dem Wegzug:</strong> Der Sitzkanton erhebt die Quellensteuer immer. Hat der Wohnsitzstaat
          laut DBA das Besteuerungsrecht (z.B. viele EU-Staaten, Brasilien nach ESTV 2-217 je Land prüfen), wird sie
          zurückerstattet – dann ist der Sitzkanton bedeutungslos und der Wohnsitzstaat besteuert. Die Ersparnis oben
          gilt nur, wo die Quellensteuer definitiv bleibt.
        </li>
        <li>
          Freizügigkeitsguthaben dürfen höchstens auf zwei Freizügigkeitseinrichtungen verteilt werden; der Wechsel der
          Einrichtung ist jederzeit möglich (Art. 12 FZV). Die Übertragung ändert die Sperrfristen nicht. Ob eine
          Einrichtung mit Sitz in ZG/SZ/NW für Ihr Guthaben verfügbar ist, ist bei den Anbietern zu klären (OFFEN).
        </li>
        <li>
          Die Zuordnung «Sitz oder Betriebsstätte» bei Anbietern mit Filialen (z.B. Banken) ist nicht abschliessend
          geklärt (OFFEN); massgebend ist die auszahlende Stelle, die die Quellensteuer abrechnet.
        </li>
        <li>
          Ein Wohnsitzwechsel in den Tiefsteuerkanton <em>vor</em> dem Bezug wirkt dagegen bei Wohnsitz in der Schweiz:
          Auf {fmtChf(b)} betrüge die Steuer dort{' '}
          {strategie.map((s) => `${s.sitz} ${fmtChf(s.wohnsitzVerlegen.steuer)}`).join(', ')}
          {kantonNach(wohn)
            ? `, in ${wohn} ${fmtChf(kapitalSteuerWohnsitz(wohn, b, zs, regeln, h.steuern).total)}`
            : ''}
          . Massgebend ist der Wohnsitz am Tag der Fälligkeit (Steuerumgehung vorbehalten – Einzelfallprüfung, OFFEN).
        </li>
      </ul>
      <p className="klein">
        Modellrechnung, keine Steuer- oder Rechtsberatung. Ergebnis und Werte prüfen Sie mit der zuständigen
        Steuerbehörde.
      </p>
      <details>
        <summary>Quellen und Stand</summary>
        <ul className="liste klein">
          {KANTONS_QUELLEN.map((q) => (
            <li key={q.url}>
              {q.text}:{' '}
              <a href={q.url} target="_blank" rel="noreferrer">
                {q.url}
              </a>{' '}
              (Stand {q.stand})
            </li>
          ))}
          <li>
            OFFEN: Nutzungsbedingungen der ESTV-Rechner-Schnittstelle (die Werte sind zur Build-Zeit erhoben, die App
            ruft sie nie auf); Gemeinde- und Kirchensteuer für die 24 Kantone ohne exakte Tarife.
          </li>
        </ul>
      </details>
    </Karte>
  );
}
