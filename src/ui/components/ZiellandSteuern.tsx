/**
 * Steuern nach dem Wegzug: Zusammenfassung des Steuermodells des Ziellands (data/laender-2026.json,
 * core/zielland.ts) mit Quellen und Stand, im Modus «Detailliert» zusätzlich Option (z.B. Italien 7 %,
 * Azoren), eigener effektiver Satz und Rückforderung der Kapital-Quellensteuer gemäss DBA.
 */
import type { Person, PersonInfo, WohnsitzAusland } from '../../core/typen';
import { ziellandKurz } from '../../core/zielland';
import { wegzugsLand } from '../../data/laender';
import { fmtChf, fmtProzent } from '../format';
import { AuswahlFeld, Schalter, ZahlFeld } from './Felder';

interface Props {
  p: Person;
  set: (fn: (p: Person) => Person) => void;
  info: PersonInfo | null;
  /** Eingabefelder (Modus «Detailliert») */
  details: boolean;
}

const QST_RENTE: Record<string, string> = {
  ja: 'PK-Renten: Schweizer Quellensteuer des Sitzkantons der Vorsorgeeinrichtung, definitiv (ESTV 2-217).',
  rueckforderbar:
    'PK-Renten: Schweizer Quellensteuer wird abgezogen, ist aber gemäss DBA rückforderbar (ESTV 2-217) – im Rechner als zurückerstattet angenommen.',
  nein: 'PK-Renten: keine Schweizer Quellensteuer (DBA weist das Besteuerungsrecht dem Wohnsitzstaat zu, ESTV 2-217).',
};

export function ZiellandSteuerFelder({ p, set, info, details }: Props) {
  const w = p.wohnsitzAusland;
  const land = wegzugsLand(w.land);
  if (!w.aktiv || !land) return null;
  const setW = (patch: Partial<WohnsitzAusland>) =>
    set((x) => ({ ...x, wohnsitzAusland: { ...x.wohnsitzAusland, ...patch } }));
  const m = land.steuern;
  const z = info?.zielland ?? null;
  const eigener = w.steuerSatzZielland !== null;
  return (
    <div className="zielland-steuern">
      <h4>Steuern nach dem Wegzug</h4>
      {m ? (
        <p className={`badge badge--${m.status === 'verifiziert' ? 'exakt' : 'naeherung'}`} role="status">
          {land.name}: {ziellandKurz(m)} – {m.status === 'verifiziert' ? 'belegt' : 'Näherung'}
        </p>
      ) : (
        <p className="warnung">
          Für «{land.name}» ist kein Steuermodell hinterlegt: Der Rechner rechnet nach dem Wegzug weiter mit Schweizer
          Steuern (Näherung).
          {details
            ? ' Besser: unten einen eigenen effektiven Steuersatz erfassen.'
            : ' Eigener Satz im Modus «Detailliert».'}
        </p>
      )}
      <ul className="liste klein">
        <li>
          Schweizer Einkommens- und Vermögenssteuer:{' '}
          {m || eigener ? 'entfällt ab dem Wegzug (im Wegzugsjahr anteilig).' : 'weiter gerechnet (kein Modell).'}
        </li>
        <li>AHV-Renten: keine Schweizer Steuer bei Wohnsitz im Ausland.</li>
        {m ? <li>{QST_RENTE[m.chQstPkRente]}</li> : null}
        {m ? (
          <li>
            Kapital-Quellensteuer:{' '}
            {m.kapitalRueckforderbar ? 'gemäss DBA rückforderbar' : 'definitiv, nicht rückforderbar'} (ESTV 2-217, Stand
            1.1.2026).
          </li>
        ) : null}
      </ul>
      {m ? (
        <details className="aufklapp">
          <summary>Annahmen und Quellen ({land.name})</summary>
          <ul className="liste klein">
            {m.hinweise.map((h) => (
              <li key={h}>{h}</li>
            ))}
            {m.waehrung && m.waehrung !== 'CHF' && m.kursProChf ? (
              <li>
                Tarife in {m.waehrung}, umgerechnet mit 1 CHF = {m.kursProChf.toLocaleString('de-CH')} {m.waehrung}. Die
                Stufen gelten wie die Schweizer Tarife als an die Teuerung angepasst.
              </li>
            ) : null}
          </ul>
          <p className="klein">Quellen:</p>
          <ul className="liste klein quellen">
            {m.quellen.map((q) => (
              <li key={q.url + q.text}>
                <a href={q.url} target="_blank" rel="noreferrer">
                  {q.text}
                </a>{' '}
                (Stand {q.stand})
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {details ? (
        <>
          {m?.optionen?.length ? (
            <AuswahlFeld
              label="Besonderes Steuerregime"
              value={w.steuerOption}
              optionen={[
                { value: '', label: 'Keines (ordentliche Besteuerung)' },
                ...m.optionen.map((o) => ({ value: o.code, label: o.label })),
              ]}
              onChange={(v) => setW({ steuerOption: v })}
              hinweis="Nur wählen, wenn die Voraussetzungen erfüllt sind (z.B. Italien: Zuzug in eine kleine Gemeinde im Süden, höchstens 10 Jahre)."
            />
          ) : null}
          <Schalter
            label="Eigenen effektiven Steuersatz im Zielland verwenden"
            hinweis="Ersetzt das Ländermodell: Satz × alle Einkünfte nach dem Wegzug (Renten, Lohn, Vermögensertrag). Z.B. aus einer Beratung oder der letzten Steuerrechnung."
            checked={eigener}
            onChange={(v) => setW({ steuerSatzZielland: v ? 0.15 : null })}
          />
          {eigener ? (
            <ZahlFeld
              label="Effektiver Steuersatz im Zielland"
              value={w.steuerSatzZielland ?? 0}
              prozent
              nachkomma={1}
              min={0}
              max={0.6}
              onChange={(v) => setW({ steuerSatzZielland: v })}
            />
          ) : null}
          {m?.kapitalRueckforderbar ? (
            <>
              <Schalter
                label="Quellensteuer auf Vorsorgekapital zurückfordern (DBA)"
                hinweis="Antrag innert 3 Jahren bei der Steuerverwaltung des Sitzkantons, mit Bestätigung der Steuerbehörde im Wohnsitzstaat. Dann wird das Kapital dort besteuert."
                checked={w.qstKapitalRueckforderung}
                onChange={(v) => setW({ qstKapitalRueckforderung: v })}
              />
              {w.qstKapitalRueckforderung ? (
                <>
                  {m.kapitalVorsorgeSatz !== undefined ? (
                    <p className="klein">
                      Steuer im Zielland auf Vorsorgekapital laut Ländermodell: {fmtProzent(m.kapitalVorsorgeSatz)}{' '}
                      (siehe Quellen).
                    </p>
                  ) : null}
                  <Schalter
                    label="Eigener Steuersatz im Zielland auf das Vorsorgekapital"
                    hinweis={
                      m.kapitalVorsorgeSatz === undefined
                        ? 'Für dieses Land ist die Besteuerung von Vorsorgekapital OFFEN. Ohne eigenen Satz rechnet der Rechner ohne Rückforderung (die Schweizer Quellensteuer bleibt).'
                        : 'Ersetzt den Satz des Ländermodells.'
                    }
                    checked={w.steuerSatzKapitalZielland !== null}
                    onChange={(v) => setW({ steuerSatzKapitalZielland: v ? (m.kapitalVorsorgeSatz ?? 0.1) : null })}
                  />
                  {w.steuerSatzKapitalZielland !== null ? (
                    <ZahlFeld
                      label="Steuersatz auf Vorsorgekapital im Zielland"
                      value={w.steuerSatzKapitalZielland}
                      prozent
                      nachkomma={1}
                      min={0}
                      max={0.6}
                      onChange={(v) => setW({ steuerSatzKapitalZielland: v })}
                    />
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {z ? (
        <div className="info" role="status">
          <p>
            <strong>{z.jahr}</strong> (erstes volles Jahr im Ausland, heutige Franken):{' '}
            {z.chSteuernWeiter
              ? 'weiter Schweizer Einkommens- und Vermögenssteuer (kein Modell).'
              : `Steuern im Zielland ca. ${fmtChf(z.steuer)}${z.einkommen > 0 ? ` (${fmtProzent(z.steuer / z.einkommen)} von ${fmtChf(z.einkommen)} Einkünften)` : ''}${z.eigenerSatz ? ', eigener Satz' : ''}.`}
            {z.quellensteuerRente > 0
              ? ` Schweizer Quellensteuer auf der PK-Rente ca. ${fmtChf(z.quellensteuerRente)}.`
              : ''}
          </p>
          {info && info.quellensteuerRente > 0 && z.quellensteuerRente === 0 ? (
            <p className="klein">
              Quellensteuer auf der PK-Rente über die ganze Planung: ca. {fmtChf(info.quellensteuerRente)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
