/**
 * Umkehrrechnung im Ergebnis: höchste nachhaltige Ausgaben (konstant oder nach Ausgabenkurve), Ziel am
 * Planungsalter (Restbetrag oder Kaufkraft ± % pro Jahr), deterministisch mit Krisenszenario oder Monte Carlo.
 * Rechnet erst auf Knopfdruck (Monte Carlo: viele Simulationen).
 */
import { useState } from 'react';
import { entnahmeAusgaben } from '../../core/entnahme';
import { inDarstellung } from '../../core/nominal';
import { referenzPerson } from '../../core/simulation';
import type { Haushalt, KrisenModus, Monat } from '../../core/typen';
import {
  phasenAbHeute,
  type UmkehrEinstellung,
  type UmkehrErgebnis,
  type UmkehrMethode,
  umkehrrechnung,
} from '../../core/umkehr';
import { AUSGABENKURVE, AUSGABENKURVE_HERLEITUNG, AUSGABENKURVE_QUELLEN } from '../../data/ausgabenkurve';
import { neueAusgabenPhase } from '../../data/defaults';
import { KRISEN_DATEN, krisenOptionen, mcKrisenPool, STANDARD_KRISEN_PRO_DEKADE } from '../../data/krisen';
import type { Regeln } from '../../rules';
import { darstellungVon } from '../darstellung';
import { fmtChf, fmtProzent } from '../format';
import type { Setzer } from '../kontext';
import { KEIN_WAS_WAERE, mitWasWaere } from './Auswertung';
import { BetragFeld, Schalter, Segmente, ZahlFeld } from './Felder';
import { JahresUebersicht } from './JahresUebersicht';
import { Karte } from './Karte';

export type UmkehrRechnung = KrisenModus | 'montecarlo';

/** Läufe der Monte-Carlo-Umkehrrechnung (höchstens; Rechenzeit) */
export const UMKEHR_MC_LAEUFE = 200;

/** Methode aus der Auswahl: deterministisch mit dem Krisenmodus oder Monte Carlo (Einstellungen der MC-Karte). */
export function umkehrMethode(h: Haushalt, rechnung: UmkehrRechnung, quote: number, jahr: number): UmkehrMethode {
  if (rechnung === 'montecarlo') {
    return {
      art: 'montecarlo',
      quote,
      einstellung: {
        art: h.krisen.mcArt,
        laeufe: Math.min(UMKEHR_MC_LAEUFE, Math.max(20, h.krisen.mcLaeufe)),
        seed: 20260927,
        krisenProDekade: h.krisen.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE,
        blockLaenge: h.krisen.mcBlockLaenge,
        bootstrapLand: 'CHE',
      },
      daten: KRISEN_DATEN,
      pool: mcKrisenPool(),
    };
  }
  // Wie «Was wäre, wenn …?»: leere eigene Liste → Finanzkrise im Jahr nach heute
  const hk = mitWasWaere(h, { ...KEIN_WAS_WAERE, krise: rechnung }, jahr);
  return { art: 'deterministisch', krisen: krisenOptionen(hk) };
}

/** Phasen für «Übernehmen» bzw. die Vorlage: ab heutigem Alter, mit neuen Ids. */
export function phasenZumUebernehmen(
  h: Haushalt,
  basis: number,
  e: Omit<UmkehrEinstellung, 'ziel' | 'methode'>,
  jahr: number,
) {
  return phasenAbHeute(h, basis, e, jahr).map((p) => neueAusgabenPhase(p.von, p.bis, p.betrag));
}

interface Props {
  h: Haushalt;
  setH: Setzer;
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  namen: string[];
}

export function UmkehrKarte({ h, setH, effH, regeln, heute, namen }: Props) {
  const [variante, setVariante] = useState<'konstant' | 'kurve'>('kurve');
  const [pflege, setPflege] = useState(true);
  const [pflegeAb, setPflegeAb] = useState<number | null>(null);
  const [zielArt, setZielArt] = useState<'betrag' | 'wachstum'>('betrag');
  const [betrag, setBetrag] = useState(0);
  const [rate, setRate] = useState(0);
  const [rechnung, setRechnung] = useState<UmkehrRechnung>(h.krisen.modus);
  const [quote, setQuote] = useState(0.9);
  const [laeuft, setLaeuft] = useState(false);
  const [erg, setErg] = useState<{ r: UmkehrErgebnis; e: UmkehrEinstellung; text: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [uebernommen, setUebernommen] = useState(false);

  const ref = referenzPerson(effH.personen);
  const pflegeStandard = effH.planungsalter - AUSGABENKURVE.pflegeJahre;
  const mehrere = effH.personen.length > 1;

  const berechnen = () => {
    setLaeuft(true);
    setFehler(null);
    setUebernommen(false);
    // Kurz warten, damit «Rechnet …» sichtbar wird
    setTimeout(() => {
      try {
        const e: UmkehrEinstellung = {
          variante,
          kurve: AUSGABENKURVE,
          pflege: variante === 'kurve' && pflege,
          pflegeAb: pflegeAb ?? undefined,
          ziel: zielArt === 'betrag' ? { art: 'betrag', betrag } : { art: 'wachstum', rate },
          methode: umkehrMethode(effH, rechnung, quote, heute.jahr),
        };
        const r = umkehrrechnung(effH, regeln, heute, e);
        const text =
          rechnung === 'montecarlo'
            ? `Monte Carlo, mindestens ${fmtProzent(quote, 0)} Erfolgsquote`
            : rechnung === 'keine'
              ? 'ohne Krise'
              : rechnung === 'automatisch'
                ? 'mit Krisen (automatisch)'
                : 'mit Ihren Krisen';
        setErg({ r, e, text });
      } catch (x) {
        setFehler(String(x));
      } finally {
        setLaeuft(false);
      }
    }, 30);
  };

  const uebernehmen = () => {
    if (!erg) return;
    const phasen = phasenZumUebernehmen(h, erg.r.basis, erg.e, heute.jahr);
    setH((x) => ({
      ...x,
      entnahme: entnahmeAusgaben(),
      ausgaben: {
        ...x.ausgaben,
        lebenshaltung: erg.r.basis,
        faktorAb75: 1,
        faktorAb85: 1,
        phasenBezug: 'alter',
        phasenPerson: referenzPerson(x.personen),
        phasen,
      },
    }));
    setUebernommen(true);
  };

  const r = erg?.r;
  const refName = mehrere ? ` (${namen[ref]})` : '';
  return (
    <Karte
      titel="Wie viel kann ich ausgeben? (Umkehrrechnung)"
      untertitel="Die App sucht die höchsten Ausgaben pro Jahr, mit denen das Geld bis zum Planungsalter reicht und am Ende Ihr Ziel übrig bleibt. Gerechnet wird dafür mit «Statisch (inflationsangepasst)», auch wenn oben eine andere Entnahmestrategie gewählt ist. Alle Beträge in heutigen Franken."
    >
      <Segmente<'konstant' | 'kurve'>
        label="Ausgabenmuster"
        value={variante}
        optionen={[
          { value: 'kurve', label: 'Kurve Go-go / Slow-go / No-go' },
          { value: 'konstant', label: 'Konstant (real)' },
        ]}
        onChange={setVariante}
      />
      {variante === 'kurve' ? (
        <>
          <p className="klein">
            Bis 74 100 %, 75–84 {fmtProzent(AUSGABENKURVE.phasen[1]?.anteil ?? 0.85, 0)}, ab 85{' '}
            {fmtProzent(AUSGABENKURVE.phasen[2]?.anteil ?? 0.75, 0)} der Ausgaben der aktiven Jahre (Alter{refName}
            {mehrere ? ', jüngere Person' : ''}). Empirisch: BFS-Haushaltsbudgeterhebung, US-Studien (Quellen unten).
          </p>
          <Schalter
            label={`Pflegeheim-Reserve: ${AUSGABENKURVE.pflegeJahre} Jahre × ${fmtChf(AUSGABENKURVE.pflegeBetragJahr)} (eine Person)`}
            hinweis="Selbst zu tragender Teil eines Pflegeheims (Pension, Betreuung, Patientenbeitrag), BFS 2024; Obergrenze, kantonal verschieden, ohne Ergänzungsleistungen."
            checked={pflege}
            onChange={setPflege}
          />
          {pflege ? (
            <ZahlFeld
              label={`Pflegeheim ab Alter${refName}`}
              hinweis={`Annahme. Standard: die letzten ${AUSGABENKURVE.pflegeJahre} Jahre vor dem Planungsalter (${pflegeStandard}).`}
              value={pflegeAb ?? pflegeStandard}
              min={50}
              max={effH.planungsalter}
              nachkomma={0}
              onChange={(v) => setPflegeAb(Math.round(v) === pflegeStandard ? null : Math.round(v))}
            />
          ) : null}
        </>
      ) : null}
      <Segmente<'betrag' | 'wachstum'>
        label={`Ziel mit ${effH.planungsalter}${refName}`}
        value={zielArt}
        optionen={[
          { value: 'betrag', label: 'Restbetrag' },
          { value: 'wachstum', label: 'Kaufkraft erhalten ± %' },
        ]}
        onChange={setZielArt}
      />
      {zielArt === 'betrag' ? (
        <BetragFeld
          label="Restvermögen am Planungsalter (heute)"
          hinweis="0 = das Geld darf aufgebraucht werden."
          value={betrag}
          min={0}
          max={100_000_000}
          onChange={setBetrag}
        />
      ) : (
        <ZahlFeld
          label="Vermögen real pro Jahr"
          hinweis="0 % = Kaufkraft des heutigen Vermögens erhalten (z.B. 2 Mio. heute = 2 Mio. in heutigen Franken am Planungsalter, nominal entsprechend mehr). Negativ = darf real schrumpfen."
          value={rate}
          prozent
          nachkomma={2}
          min={-0.2}
          max={0.1}
          onChange={setRate}
        />
      )}
      <Segmente<UmkehrRechnung>
        label="Rechnung"
        value={rechnung}
        optionen={[
          { value: 'keine', label: 'Ohne Krise' },
          { value: 'automatisch', label: 'Auto\u00admatisch' },
          { value: 'individuell', label: 'Indi\u00adviduell' },
          { value: 'montecarlo', label: 'Monte Carlo' },
        ]}
        onChange={setRechnung}
      />
      {rechnung === 'montecarlo' ? (
        <ZahlFeld
          label="Mindest-Erfolgsquote"
          hinweis={`Anteil der Läufe, in denen das Geld reicht und das Ziel erreicht wird. ${Math.min(UMKEHR_MC_LAEUFE, h.krisen.mcLaeufe)} Läufe, Methode wie in der Karte «Wiederkehrende Krisen».`}
          value={quote}
          prozent
          nachkomma={0}
          min={0.5}
          max={0.99}
          onChange={setQuote}
        />
      ) : rechnung === 'individuell' && h.krisen.auswahl.length === 0 ? (
        <p className="klein">Ihre Krisenliste ist leer: gerechnet wird die Finanzkrise 2007–2009 ab nächstem Jahr.</p>
      ) : null}
      <div className="knopf-reihe">
        <button type="button" className="knopf" onClick={berechnen} disabled={laeuft}>
          {laeuft ? 'Rechnet …' : 'Berechnen'}
        </button>
      </div>
      {fehler ? <p className="warnung">Berechnung nicht möglich: {fehler}</p> : null}
      {r && erg ? (
        <div className="umkehr-ergebnis" role="status" aria-live="polite">
          {!r.erreichbar ? (
            <p className="warnung">
              Nicht erreichbar: Selbst ohne Lebenshaltungskosten bleibt am Planungsalter nicht genug übrig (Ziel{' '}
              {fmtChf(r.zielReal)}, {erg.text}).
            </p>
          ) : (
            <>
              <p className="gross">
                {fmtChf(r.basis)} <span className="klein">pro Jahr</span>
              </p>
              <p>
                = {fmtChf(r.basis / 12)} pro Monat
                {erg.e.variante === 'kurve' ? ' in den aktiven Jahren (Go-go)' : ''}, {erg.text}
                {r.quote !== null ? ` (erreicht: ${fmtProzent(r.quote, 0)})` : ''}.
                {r.obergrenze ? ' Obergrenze der Suche erreicht – es ginge noch mehr.' : ''}
              </p>
              <ul className="umkehr-phasen">
                {r.phasen.map((p) => (
                  <li key={`${p.label}-${p.vonAlter}`} className={p.pflege ? 'umkehr-phasen__pflege' : undefined}>
                    <strong>
                      {p.label}
                      {erg.e.variante === 'kurve' && !p.pflege ? ` (${fmtProzent(p.anteil, 0)})` : ''}
                    </strong>
                    <span className="klein">
                      {' '}
                      Alter {p.vonAlter === p.bisAlter ? p.vonAlter : `${p.vonAlter}–${p.bisAlter}`}
                      {refName} · {p.vonJahr === p.bisJahr ? p.vonJahr : `${p.vonJahr}–${p.bisJahr}`}
                    </span>
                    <br />
                    {fmtChf(p.monat)} pro Monat · {fmtChf(p.jahr)} pro Jahr
                  </li>
                ))}
              </ul>
              <p className="klein">
                Lebenshaltung ohne Steuern und AHV-Beiträge (die rechnet die App), in heutigen Franken. Weitere Posten,
                Einmalereignisse, einzelne Jahre und separate Wohnkosten bleiben wie eingegeben. Ziel mit{' '}
                {effH.planungsalter}: {fmtChf(r.zielReal)} in heutigen Franken
                {erg.e.ziel.art === 'wachstum'
                  ? ` (verfügbares Vermögen heute ${fmtChf(r.start)} × (1 ${erg.e.ziel.rate < 0 ? '−' : '+'} ${fmtProzent(Math.abs(erg.e.ziel.rate), 2)}) pro Jahr; ohne gesperrte PK-, Freizügigkeits- und 3a-Guthaben)`
                  : ''}
                ; nominal ca. {fmtChf(r.zielReal * (r.ergebnis.zeilen.at(-1)?.indexEnde ?? 1))}. {r.simulationen}{' '}
                Simulationen.
              </p>
              <JahresUebersicht
                e={inDarstellung(r.ergebnis, darstellungVon(h))}
                darstellung={darstellungVon(h)}
                namen={namen}
                refIdx={ref}
                titel="Verlauf mit diesen Ausgaben"
                startMonat={heute.monat}
                dateiname="ruhestand-umkehrrechnung"
              />
              {erg.e.methode.art === 'montecarlo' ? (
                <p className="klein">
                  Grafik und Tabelle zeigen den Verlauf ohne Krise mit diesen Ausgaben; die Erfolgsquote stammt aus den
                  Monte-Carlo-Läufen.
                </p>
              ) : null}
              <div className="knopf-reihe">
                <button type="button" className="knopf knopf--sekundaer" onClick={uebernehmen}>
                  Als Ausgabenphasen übernehmen
                </button>
              </div>
              {uebernommen ? (
                <p className="ok">
                  ✓ Übernommen: Ausgabenphasen nach Alter{refName} (Modus «Detailliert», Schritt «Vermögen und
                  Ausgaben»). Die Entnahmestrategie steht auf «Statisch (inflationsangepasst)», damit diese Ausgaben
                  massgebend sind. Das Ergebnis oben rechnet jetzt damit.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <details className="aufklapp-innen">
        <summary>Woher kommt die Ausgabenkurve?</summary>
        <ul className="liste">
          {AUSGABENKURVE_HERLEITUNG.map((x) => (
            <li key={x.id}>
              <strong>{x.label}</strong>: {x.herleitung} ({x.status})
            </li>
          ))}
        </ul>
        <ul className="quellen">
          {AUSGABENKURVE_QUELLEN.map((q) => (
            <li key={q.url}>
              <a href={q.url} target="_blank" rel="noreferrer noopener">
                {q.titel}
              </a>{' '}
              <small>({q.stand})</small>
            </li>
          ))}
        </ul>
      </details>
    </Karte>
  );
}
