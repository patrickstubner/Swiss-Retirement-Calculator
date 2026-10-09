/**
 * Krisenszenarien im Ergebnis: historische Krisen abspielen, Monte Carlo mit wiederkehrenden
 * Krisen und die historische Krisenhäufigkeit pro Dekade (JST R6).
 */
import { useDeferredValue, useId, useMemo, useState } from 'react';
import {
  bereinigeEigeneKrise,
  datenVollstaendig,
  EIGENE_KRISE_ID,
  filterKrisenName,
  JAHRE_NACH_MAX,
  JAHRE_NACH_MIN,
  KRISEN_START_VORLAUF,
  type KrisenLand,
  type KrisenPlanEintrag,
  krisenAusserhalb,
  krisenPfad,
  krisenPlan,
  krisenStartVorschlag,
  krisenUeberlappungen,
  MAX_GEPLANTE_KRISEN,
  maxRealerRueckgang,
  standardEigeneKrise,
} from '../../core/krisen';
import { referenzPerson, simuliere } from '../../core/simulation';
import type {
  EigeneKrise,
  Haushalt,
  KrisenAuswahl,
  KrisenEinstellungen,
  KrisenModus,
  Monat,
  Person,
  SimulationsErgebnis,
} from '../../core/typen';
import { geburtIndex, stoppAlterMonate } from '../../core/zeitpunkt';
import { neueGeplanteKrise } from '../../data/defaults';
import {
  AUTO_KRISEN,
  autoHaeufigkeit,
  automatischeKrisenAlsAuswahl,
  autoNormal,
  autoVersatz,
  HAEUFIGKEIT,
  KRISEN,
  KRISEN_DATEN,
  KRISEN_DATEN_STAND,
  type KrisenSchwere,
  kriseNach,
  krisenAbstand,
  krisenListeZusammenfuehren,
  krisenOptionen,
  krisenSchwere,
  LAND_NAMEN,
  STANDARD_KRISEN_PRO_DEKADE,
  standardErsteKrise,
} from '../../data/krisen';
import type { Regeln } from '../../rules';
import { darstellungVon, endBetrag, inFranken } from '../darstellung';
import { fmtChf, fmtProzent, MONATSNAMEN } from '../format';
import type { Setzer } from '../kontext';
import { krisenAbschnitte, krisenText } from '../krisenGrafik';
import { krisenNachModuswechsel } from '../krisenModus';
import {
  KRISEN_KATALOG_OPTIONEN,
  type KrisenFolgeText,
  krisenAktienEndeText,
  krisenErholungText,
  krisenExtremText,
  krisenHauspreisText,
  krisenPhasenText,
  krisenTiefpunktText,
} from '../krisenSchwereText';
import type { McEinstellung } from '../mcKern';
import { useVollMc } from '../mcVergleich';
import { Faecher } from './Faecher';
import { AuswahlFeld, Schalter, Segmente, TextFeld, ZahlFeld } from './Felder';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

const LAENDER: readonly KrisenLand[] = ['CHE', 'USA', 'JPN'];
const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));

export function ausgleichHinweisText(hinweis: 'zuWenig' | 'gedeckelt' | undefined): string | null {
  if (hinweis === 'zuWenig')
    return 'Weniger als 3 normale Jahre im Horizont. Der Ausgleich entfällt, die normalen Jahre bleiben Ihre Annahme.';
  if (hinweis === 'gedeckelt')
    return 'Der Ausgleich ist auf −20 % bis 30 % begrenzt (dieselbe Spanne wie die Renditeannahme). Der reale Durchschnitt entspricht dann nicht mehr genau Ihrer Annahme.';
  return null;
}
const BASIS0 = { renditeNominal: 0, renditeBargeld: 0, inflation: 0 };

function setzeKrisen(setH: Setzer, fn: (k: KrisenEinstellungen) => KrisenEinstellungen) {
  setH((h) => ({ ...h, krisen: fn(h.krisen) }));
}

const fmtJahre = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 1 });
const fmtDek = (x: number) => x.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ISO-Datum → 27.9.2026 */
const fmtStand = (iso: string) => {
  const [j, m, t] = iso.split('-');
  return `${Number(t)}.${Number(m)}.${j}`;
};

function ruecktrittJahr(h: Haushalt, heuteJahr: number): number {
  const i = Math.max(
    0,
    h.personen.findIndex((p) => p.erwerbsstatus !== 'nichtErwerbstaetig'),
  );
  const p = h.personen[i] ?? h.personen[0];
  if (!p) return heuteJahr;
  return Math.floor((geburtIndex(p) + Math.max(0, stoppAlterMonate(p))) / 12);
}

function horizontVon(h: Haushalt, heuteJahr: number): { von: number; bis: number } {
  const p = h.personen[referenzPerson(h.personen)];
  const bis = (p?.geburtsjahr ?? heuteJahr) + Math.floor(h.planungsalter);
  return { von: heuteJahr, bis: Math.max(heuteJahr, bis) };
}

function alterAmJahresende(jahr: number, personen: readonly Person[], namen: readonly string[]): string {
  if (personen.length <= 1) {
    const p = personen[0];
    return `Sie sind am Jahresende ${p ? jahr - p.geburtsjahr : 0} Jahre alt.`;
  }
  const teile = personen.map((p, i) => `${namen[i] || `Person ${i + 1}`} ${jahr - p.geburtsjahr}`);
  return `Alter am Jahresende: ${teile.join(', ')}.`;
}

function jahrSpanne(von: number, bis: number): string {
  return von === bis ? String(von) : `${von}–${bis}`;
}

interface Props {
  h: Haushalt;
  setH: Setzer;
  /** effektiver Haushalt (mit Schätzwerten) */
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  /** Wunsch-Rücktritt mit Krise (falls aktiv) */
  wunsch: SimulationsErgebnis | null;
  refIdx: number;
  namen: string[];
  /** true: einziges Eingabefeld (Modus Schnell). false: nur Anzeige, das Feld steht im Schritt Annahmen. */
  aktienanteilHier: boolean;
  /**
   * Rendite, mit der diese Auswertung rechnet (Regler «Was wäre, wenn», sonst die Eingabe).
   * Nicht `h.annahmen.renditeNominal`: der Regler ändert die Rechnung, bevor er übernommen wird.
   */
  annahmeRendite: number;
}

/** Krisenmodus und Editor. Eine Stelle, im Block «Was wäre, wenn …?», schreibt direkt in den Haushalt. */
export function KrisenSteuerung({
  h,
  setH,
  effH,
  regeln,
  heute,
  wunsch,
  refIdx,
  namen,
  aktienanteilHier,
  annahmeRendite,
}: Props) {
  const k = h.krisen;
  const [rueckfrage, setRueckfrage] = useState(false);
  const [uebernahmeHinweis, setUebernahmeHinweis] = useState<string | null>(null);
  const aktiv = krisenOptionen(effH) !== undefined;
  // Vergleich ohne Krise (gleiche Eingaben)
  const ohne = useMemo(
    () => (aktiv ? simuliere({ ...effH, krisen: { ...effH.krisen, modus: 'keine' } }, regeln, { start: heute }) : null),
    [aktiv, effH, regeln, heute],
  );
  const abschnitte = useMemo(() => (wunsch ? krisenAbschnitte(wunsch, refIdx) : []), [wunsch, refIdx]);
  const fenster = useMemo(() => horizontVon(h, heute.jahr), [h, heute.jahr]);
  const plan = useMemo(() => {
    if (k.modus !== 'individuell') return [] as KrisenPlanEintrag[];
    const opt = krisenOptionen(h);
    if (!opt) return [] as KrisenPlanEintrag[];
    return krisenPlan(
      opt.wahl,
      ruecktrittJahr(h, heute.jahr),
      h.personen.map((p) => p.geburtsjahr),
    );
  }, [k.modus, h, heute.jahr]);
  const ueberlappung = useMemo(() => krisenUeberlappungen(plan), [plan]);
  const ausserhalb = useMemo(() => krisenAusserhalb(plan, fenster.von, fenster.bis), [plan, fenster]);
  const rate = autoHaeufigkeit(k);
  const standardJahr = standardErsteKrise(rate);
  // Ausgleich über den eigenen Planungshorizont (aus der Simulation mit Wunsch-Rücktritt)
  const normal =
    k.modus === 'automatisch' || (k.modus === 'individuell' && k.ausgleich === true)
      ? (wunsch?.krisenNormal ?? null)
      : null;
  const umlauf = k.modus === 'automatisch' ? autoNormal(effH) : null;
  const horizont = wunsch ? `${wunsch.zeilen[0]?.jahr ?? heute.jahr}–${wunsch.zeilen.at(-1)?.jahr ?? ''}` : '';
  const erwName =
    namen[
      Math.max(
        0,
        h.personen.findIndex((p) => p.erwerbsstatus !== 'nichtErwerbstaetig'),
      )
    ];

  const setzeAuswahl = (i: number, fn: (a: KrisenAuswahl) => KrisenAuswahl) =>
    setzeKrisen(setH, (kr) => ({ ...kr, auswahl: kr.auswahl.map((a, j) => (j === i ? fn(a) : a)) }));

  const uebernahme = useMemo(
    () => automatischeKrisenAlsAuswahl(k, ruecktrittJahr(h, heute.jahr), fenster),
    [k, h, heute.jahr, fenster],
  );

  const uebernimm = (art: 'ersetzen' | 'anhaengen') => {
    setRueckfrage(false);
    if (uebernahme.length === 0) {
      setUebernahmeHinweis('Im Planungshorizont liegt keine automatische Krise.');
      return;
    }
    if (art === 'ersetzen') {
      setzeKrisen(setH, (kr) => ({ ...kr, auswahl: uebernahme, ausgleich: true }));
      setUebernahmeHinweis(null);
      return;
    }
    const zusammen = krisenListeZusammenfuehren(k.auswahl, uebernahme);
    setzeKrisen(setH, (kr) => ({ ...kr, auswahl: zusammen.auswahl, ausgleich: true }));
    setUebernahmeHinweis(
      zusammen.ausgelassen > 0
        ? `${zusammen.ausgelassen} ${zusammen.ausgelassen === 1 ? 'Krise passt' : 'Krisen passen'} nicht mehr in die Liste (höchstens ${MAX_GEPLANTE_KRISEN}).`
        : null,
    );
  };

  const kriseHinzufuegen = () =>
    setzeKrisen(setH, (kr) => {
      if (kr.auswahl.length >= MAX_GEPLANTE_KRISEN) return kr;
      const letzte = plan.at(-1)?.startJahr ?? fenster.von;
      const jahr = krisenStartVorschlag(fenster.von, fenster.bis, Math.max(0, letzte + 14 - 2036));
      const benutzt = new Set(kr.auswahl.map((x) => x.id));
      const naechste = KRISEN.find((x) => !benutzt.has(x.id)) ?? KRISEN[0];
      return {
        ...kr,
        auswahl: [...kr.auswahl, neueGeplanteKrise(naechste?.id ?? 'dotcom2000', naechste?.land ?? 'CHE', jahr)],
      };
    });

  return (
    <div className="krisen-steuerung">
      <Segmente<KrisenModus>
        label="Krisen"
        value={k.modus}
        optionen={[
          { value: 'keine', label: 'Keine' },
          { value: 'automatisch', label: 'Auto\u00admatisch' },
          { value: 'individuell', label: 'Indi\u00adviduell' },
        ]}
        onChange={(modus) => {
          setRueckfrage(false);
          const wechsel = krisenNachModuswechsel(k, modus, uebernahme);
          setUebernahmeHinweis(wechsel.hinweis);
          setzeKrisen(setH, () => wechsel.krisen);
        }}
      />
      {k.modus === 'keine' ? (
        <p className="klein">
          Jedes Jahr gilt Ihre Renditeannahme – ein glatter, eher zu schöner Verlauf. Standard ist «Automatisch»
          (realistischer).
        </p>
      ) : null}

      {k.modus === 'automatisch' ? (
        <>
          <p className="klein">
            Standard für neue Berechnungen. Die App legt die «normalen» Krisen der Geschichte der Reihe nach in die
            Zukunft: {AUTO_KRISEN.map((x) => x.kurz).join(', ')} – danach wieder von vorne. Die Grosse Depression, die
            Stagflation 1973–81 und Japan ab 1990 gelten als extrem; sie sind nur bei «Individuell» wählbar. Die
            Reihenfolge hier ist der historische Ablauf, nicht die Schwere. Rückgang, Katalogphase und historische
            Erholung stehen bei «Individuell» an der gewählten Krise.
          </p>
          <ZahlFeld
            label="Krisen pro 10 Jahre"
            hinweis={`Standard ${fmtDek(STANDARD_KRISEN_PRO_DEKADE)}: so oft fielen Schweizer Aktien real um 20 % oder mehr (1900–2020, JST). Das heisst im Schnitt alle ${fmtJahre(krisenAbstand(STANDARD_KRISEN_PRO_DEKADE))} Jahre eine Krise. Gilt für diese feste Abfolge, nicht für die Zufallsrechnung unter «Wiederkehrende Krisen».`}
            value={rate}
            min={0.1}
            max={5}
            nachkomma={2}
            onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, autoProDekade: v }))}
          />
          <Segmente<'jahr' | 'nachRuecktritt'>
            label="Erste Krise"
            value={k.autoStartArt}
            optionen={[
              { value: 'jahr', label: 'Im Kalenderjahr' },
              { value: 'nachRuecktritt', label: 'Nach dem Rücktritt' },
            ]}
            onChange={(autoStartArt) => setzeKrisen(setH, (kr) => ({ ...kr, autoStartArt }))}
          />
          {k.autoStartArt === 'jahr' ? (
            <ZahlFeld
              label="Kalenderjahr der ersten Krise"
              hinweis={`Standard ${standardJahr}: letzte Krise der Liste (Zinsschock 2022) plus ein mittlerer Abstand von ${fmtJahre(krisenAbstand(rate))} Jahren, gerundet. So läuft der historische Rhythmus weiter.`}
              value={k.autoStartJahr ?? standardJahr}
              min={1900}
              max={2200}
              nachkomma={0}
              onChange={(j) =>
                setzeKrisen(setH, (kr) => ({
                  ...kr,
                  autoStartJahr: Math.round(j) === standardJahr ? null : Math.round(j),
                }))
              }
            />
          ) : (
            <ZahlFeld
              label="Jahre nach dem Rücktritt"
              hinweis={`0 = im Jahr des Rücktritts von ${erwName}. Das ist ein Stresstest: Eine Krise gleich nach dem Rücktritt trifft am härtesten.`}
              value={k.autoJahreNach}
              min={-30}
              max={60}
              nachkomma={0}
              einheit="Jahre"
              onChange={(j) => setzeKrisen(setH, (kr) => ({ ...kr, autoJahreNach: Math.round(j) }))}
            />
          )}
          {normal ? (
            <p className="klein">
              Die Krisenjahre ersetzen Ihre Renditeannahme – sie kommen nicht noch dazu. Damit der Durchschnitt Ihrer
              Annahme entspricht, rechnet die App in normalen Jahren mit{' '}
              <strong>{fmtProzent(normal.wertschriften, 2)}</strong> statt {fmtProzent(annahmeRendite, 2)}{' '}
              (Wertschriften, Ihr Mix) und mit <strong>{fmtProzent(normal.wohneigentum, 2)}</strong> (Hauspreise).
              {normal.hinweis
                ? ` ${ausgleichHinweisText(normal.hinweis)}`
                : ` So entspricht der reale Durchschnitt über Ihren Planungszeitraum (${horizont}) genau Ihrer Annahme – mit den Krisen, die in diesen Zeitraum fallen.`}
              {umlauf
                ? ` Zum Vergleich: Ausgleich über einen ganzen Umlauf der Liste (${autoVersatz(AUTO_KRISEN.length, rate)} Jahre) wären ${fmtProzent(umlauf.wertschriften, 2)}.`
                : ''}
            </p>
          ) : null}
        </>
      ) : null}

      {k.modus === 'individuell' ? (
        <>
          {k.auswahl.length === 0 ? (
            <div className="krisen-leer" role="status">
              <p>
                Noch keine Krise in der Liste. Fügen Sie eine hinzu oder übernehmen Sie die automatischen Krisen.
                Solange die Liste leer ist, setzt diese Auswertung die Finanzkrise 2007–2009 ab nächstem Jahr.
              </p>
              {uebernahmeHinweis ? <p className="warnung">{uebernahmeHinweis}</p> : null}
              <div className="knopf-reihe">
                <button type="button" className="knopf" onClick={() => uebernimm('ersetzen')}>
                  Automatische Krisen übernehmen
                </button>
                <button type="button" className="knopf knopf--sekundaer" onClick={kriseHinzufuegen}>
                  Krise hinzufügen
                </button>
              </div>
            </div>
          ) : null}
          <p className="klein">
            {k.ausgleich === true
              ? normal?.hinweis
                ? 'Die Krisenjahre ersetzen die Renditeannahme. Der Ausgleich der normalen Jahre gilt nur eingeschränkt, siehe Hinweis unten.'
                : 'Die Krisenjahre ersetzen die Renditeannahme. Normale Jahre werden ausgeglichen, wie im Modus Automatisch: der reale Durchschnitt über den Planungshorizont entspricht Ihrer Annahme.'
              : 'Legen Sie fest, welche historische Krise in welchem zukünftigen Jahr wiederkehrt. Das ist ein Stresstest: Die Krisenjahre ersetzen die Renditeannahme, die übrigen Jahre bleiben unverändert.'}{' '}
            Höchstens {MAX_GEPLANTE_KRISEN} Einträge. Ein Beginn kurz vor {fenster.von} zählt mit, sobald ein Krisenjahr
            im Horizont {fenster.von}–{fenster.bis} liegt. Der Monat ist eine Annäherung: die Daten sind Jahresrenditen,
            die App verteilt sie geometrisch auf die Kalenderjahre. Januar rechnet das ganze Jahr, wie bisher.
          </p>
          <Schalter
            label="Normale Jahre ausgleichen (wie Automatisch)"
            checked={k.ausgleich === true}
            hinweis="Ein: derselbe Ausgleich wie im Modus Automatisch. Aus: Stresstest. «Automatische Krisen übernehmen» schaltet den Ausgleich ein. Spätere Änderungen an der Liste lassen ihn, wie er steht."
            onChange={(ausgleich) => setzeKrisen(setH, (kr) => ({ ...kr, ausgleich }))}
          />
          {k.autoStartArt === 'nachRuecktritt' ? (
            <p className="klein">
              Automatisch beginnt nach dem Rücktritt. Die Übernahme behält den Abstand, damit die Krisen mit dem
              Rücktritt mitwandern.
            </p>
          ) : null}
          {k.auswahl.length > 0 ? (
            <button type="button" className="knopf" onClick={() => setRueckfrage(true)}>
              Automatische Krisen übernehmen
            </button>
          ) : null}
          {k.auswahl.length > 0 && rueckfrage ? (
            <fieldset className="unterkarte">
              <legend>Liste ist schon gefüllt</legend>
              <p>
                Die Liste enthält bereits {k.auswahl.length} {k.auswahl.length === 1 ? 'Eintrag' : 'Einträge'}. Ersetzen
                überschreibt sie. Anhängen ergänzt nur Krisen, die noch fehlen.
              </p>
              <div className="knopf-reihe">
                <button type="button" className="knopf" onClick={() => uebernimm('ersetzen')}>
                  Ersetzen
                </button>
                <button type="button" className="knopf knopf--sekundaer" onClick={() => uebernimm('anhaengen')}>
                  Anhängen
                </button>
                <button type="button" className="knopf knopf--sekundaer" onClick={() => setRueckfrage(false)}>
                  Abbrechen
                </button>
              </div>
            </fieldset>
          ) : null}
          {k.auswahl.length > 0 && uebernahmeHinweis ? (
            <p className="warnung" role="status">
              {uebernahmeHinweis}
            </p>
          ) : null}
          {normal && k.ausgleich === true ? (
            <p className="klein">
              In normalen Jahren rechnet die App mit <strong>{fmtProzent(normal.wertschriften, 2)}</strong> statt{' '}
              {fmtProzent(annahmeRendite, 2)} (Wertschriften) und mit{' '}
              <strong>{fmtProzent(normal.wohneigentum, 2)}</strong> (Hauspreise), über{' '}
              {horizont || 'den Planungshorizont'}.{normal.hinweis ? ` ${ausgleichHinweisText(normal.hinweis)}` : ''}
            </p>
          ) : null}
          {k.auswahl.map((a, i) => (
            <GeplanteKrise
              key={a.uid}
              a={a}
              i={i}
              anzahl={k.auswahl.length}
              startJahr={plan[i]?.startJahr}
              h={h}
              namen={namen}
              fenster={fenster}
              erwName={erwName}
              folge={{
                ausgleich: k.ausgleich === true,
                renditeNominal: annahmeRendite,
                ...(normal
                  ? { hauspreisAusgeglichen: normal.wohneigentum, wertschriftenAusgeglichen: normal.wertschriften }
                  : {}),
              }}
              setze={(fn) => setzeAuswahl(i, fn)}
              entfernen={() => setzeKrisen(setH, (kr) => ({ ...kr, auswahl: kr.auswahl.filter((_, j) => j !== i) }))}
            />
          ))}
          {ueberlappung.map((u) => (
            <p key={`ueber-${u.jahrVon}-${u.gilt}-${u.verdraengt}`} className="warnung">
              {u.verdraengt
                ? `${u.verdraengt} und ${u.gilt} überschneiden sich ${jahrSpanne(u.jahrVon, u.jahrBis)}. Es gilt ${u.gilt} (späterer Beginn, bei gleichem Jahr der Eintrag weiter unten). `
                : `${u.gilt} (${jahrSpanne(u.jahrVon, u.jahrBis)}). Die kürzere Krise gilt nur in ihrem Abschnitt, danach läuft die frühere weiter. `}
              Die Jahre werden nicht doppelt gezählt.
            </p>
          ))}
          {ausserhalb.map((e) => (
            <p key={`aussen-${e.krise.id}-${e.startJahr}`} className="warnung">
              {e.krise.kurz} (Beginn {e.startJahr}): kein Jahr dieser Krise liegt im Planungshorizont {fenster.von}–
              {fenster.bis}. Sie fliesst so nicht in die Rechnung ein.
            </p>
          ))}
          {k.auswahl.length > 0 && k.auswahl.length < MAX_GEPLANTE_KRISEN ? (
            <button type="button" className="knopf knopf--sekundaer" onClick={kriseHinzufuegen}>
              Krise hinzufügen
            </button>
          ) : null}
          {k.auswahl.length >= MAX_GEPLANTE_KRISEN ? (
            <p className="klein">
              Höchstens {MAX_GEPLANTE_KRISEN} Krisen. Entfernen Sie einen Eintrag, um einen neuen zu setzen.
            </p>
          ) : null}
        </>
      ) : null}

      {aktienanteilHier ? (
        <AktienanteilFeld h={h} setH={setH} />
      ) : (
        <p className="klein">
          Aktienanteil Ihrer Wertschriften: {fmtProzent(h.annahmen.aktienanteil, 0)}. Ändern im Schritt «Annahmen».
        </p>
      )}

      {k.modus !== 'keine' ? (
        <>
          {wunsch && ohne ? (
            <div className="vergleich" role="status">
              <div>
                <h3>Ohne Krise</h3>
                <p>{ohne.erfolg ? 'Reicht bis zum Planungsalter' : `Reicht bis ${ohne.ruinJahr}`}</p>
                <p className="klein">Am Ende: {fmtChf(endBetrag(ohne, darstellungVon(h)))}</p>
              </div>
              <div>
                <h3>{k.modus === 'automatisch' ? 'Mit Krisen (automatisch)' : 'Mit Ihren Krisen'}</h3>
                <p className={wunsch.erfolg ? 'ok' : 'negativ'}>
                  {wunsch.erfolg
                    ? 'Reicht bis zum Planungsalter'
                    : `Reicht bis ${wunsch.ruinJahr} (Alter ${wunsch.ruinAlter})`}
                </p>
                <p className="klein">Am Ende: {fmtChf(endBetrag(wunsch, darstellungVon(h)))}</p>
              </div>
            </div>
          ) : null}
          {abschnitte.length > 0 ? (
            <p className="krisen-legende">
              <span className="krisen-legende__farbe" aria-hidden="true" /> Krisen in Ihrer Rechnung:{' '}
              {krisenText(abschnitte)}. Im Vermögensverlauf farbig hinterlegt.
            </p>
          ) : aktiv ? (
            <p className="warnung">Die Krisenjahre liegen ausserhalb des Planungszeitraums.</p>
          ) : null}
        </>
      ) : null}
      <details className="aufklapp-innen">
        <summary>Wie wird gerechnet?</summary>
        <ul className="klein">
          <li>
            Wertschriften: Aktienanteil × Aktienrendite + Rest × Obligationenrendite des Krisenjahres (Gesamtrendite mit
            Dividenden/Zinsen, in Landeswährung, ohne Währungseffekt). Bargeld: Geldmarktzins. Wohneigentum: Veränderung
            der Hauspreise (falls vorhanden, sonst Ihre Annahme).
          </li>
          <li>
            Die Krisenrenditen ersetzen in den Krisenjahren Ihre Annahme. «Automatisch»: Die normalen Jahre werden so
            erhöht, dass der reale Durchschnitt von heute bis zum Planungsalter Ihrer Annahme entspricht (Wertschriften
            und Hauspreise je separat) – Krisen werden also nicht doppelt gezählt, wenn Ihre Annahme ein langfristiger
            Durchschnitt ist. «Individuell» ist ohne Ausgleich ein Stresstest. Mit «Normale Jahre ausgleichen» gilt
            derselbe Ausgleich wie bei «Automatisch».
          </li>
          <li>
            Teuerung des Krisenjahres: Ausgaben steigen mit, PK-Renten nicht (sie verlieren real an Wert). AHV-Renten
            werden vereinfacht voll an die Teuerung angepasst.
          </li>
          <li>
            Anlagekosten werden wie sonst abgezogen. Überschneiden sich zwei Krisen, gilt die später beginnende (bei
            gleichem Beginn der Eintrag weiter unten). Die Jahre werden nicht addiert. «Eigene Krise» ist eine Annahme
            (Rückgang, Dauer, Erholung), keine historische Reihe.
          </li>
          <li>
            Jahresdaten: Einbrüche innerhalb eines Jahres (z.B. März 2020) sind nicht sichtbar. Quelle:
            Jordà-Schularick-Taylor Macrohistory Database R6 (CC BY-NC-SA 4.0), Schweiz 2021–2024 SNB-Datenportal und
            BFS. Stand {fmtStand(KRISEN_DATEN_STAND)}.
          </li>
        </ul>
      </details>
      <HaeufigkeitTabelle />
    </div>
  );
}

function KriseSchwereInfo({
  kriseId,
  kriseName,
  standardLand,
  land,
  s,
  folge,
}: {
  kriseId: string;
  kriseName: string;
  standardLand: KrisenLand;
  land: KrisenLand;
  s: KrisenSchwere;
  folge: KrisenFolgeText;
}) {
  const rueckgang =
    s.jahreBisTiefpunkt === null
      ? 'keiner unter dem Vorkrisenstand'
      : `${fmtProzent(s.maxRueckgang, 1)} (Peak-to-Trough, kumuliert)`;
  const hauspreise = krisenHauspreisText(s, folge);
  const extrem = krisenExtremText(kriseId);
  return (
    <div className="krise-schwere">
      <dl aria-label={`Schwere: ${kriseName}`}>
        <div>
          <dt>Krise</dt>
          <dd>{kriseName}</dd>
        </div>
        <div>
          <dt>Startjahr</dt>
          <dd>{s.startjahr}</dd>
        </div>
        <div>
          <dt>Maximaler Rückgang</dt>
          <dd>{rueckgang}</dd>
        </div>
        <div>
          <dt>Aktien-Tiefpunkt</dt>
          <dd>{krisenTiefpunktText(s)}</dd>
        </div>
        <div>
          <dt>Katalogphase</dt>
          <dd>{krisenPhasenText(s, folge)}</dd>
        </div>
        <div>
          <dt>Historische Erholung</dt>
          <dd>{krisenErholungText(s)}</dd>
        </div>
        <div>
          <dt>Aktien am Phasenende</dt>
          <dd>{krisenAktienEndeText(s)}</dd>
        </div>
        {hauspreise ? (
          <div>
            <dt>Hauspreise</dt>
            <dd>{hauspreise}</dd>
          </div>
        ) : null}
        {extrem ? (
          <div>
            <dt>Einordnung</dt>
            <dd>{extrem}</dd>
          </div>
        ) : null}
      </dl>
      <p className="klein">
        Jahreswerte. Realer Aktien-Gesamtertrag, inkl. Dividenden, 100 % Aktien, {LAND_NAMEN[land]}. Der
        Aktien-Tiefpunkt ist ein Jahresende, nicht ein Monat. Die historische Erholung nach der Katalogphase fliesst
        nicht in die Rechnung.
        {land !== standardLand ? ` Die Liste sortiert nach der Standardreihe ${LAND_NAMEN[standardLand]}.` : ''}
      </p>
    </div>
  );
}

function GeplanteKrise({
  a,
  i,
  anzahl,
  startJahr,
  h,
  namen,
  fenster,
  erwName,
  folge,
  setze,
  entfernen,
}: {
  a: KrisenAuswahl;
  i: number;
  anzahl: number;
  startJahr: number | undefined;
  h: Haushalt;
  namen: string[];
  fenster: { von: number; bis: number };
  erwName: string | undefined;
  folge: KrisenFolgeText;
  setze: (fn: (a: KrisenAuswahl) => KrisenAuswahl) => void;
  entfernen: () => void;
}) {
  const eigen = a.id === EIGENE_KRISE_ID;
  const krise = eigen ? undefined : kriseNach(a.id);
  const land = krise && LAENDER.includes(a.land) ? a.land : (krise?.land ?? 'CHE');
  const schwere = krise ? krisenSchwere(krise, land) : null;
  const pfad = krise ? krisenPfad(krise, land, h.annahmen.aktienanteil, KRISEN_DATEN, BASIS0) : null;
  const dd = pfad ? maxRealerRueckgang(pfad) : null;
  const teuerungMix = pfad ? pfad.reduce((s, p) => s * (1 + p.teuerung), 1) - 1 : null;
  const lander = krise ? LAENDER.filter((l) => datenVollstaendig(krise, l, KRISEN_DATEN)) : [];
  const beginn = startJahr ?? a.jahr;
  const monat = a.monat ?? 1;
  const monatName = MONATSNAMEN[monat - 1] ?? 'Januar';
  const eigene = eigen ? bereinigeEigeneKrise(a.eigen) : null;
  const setEigen = (patch: Partial<EigeneKrise>) =>
    setze((x) => ({ ...x, id: EIGENE_KRISE_ID, eigen: { ...bereinigeEigeneKrise(x.eigen), ...patch } }));

  return (
    <div className="unterkarte krise">
      <AuswahlFeld
        label={anzahl > 1 ? `Krise ${i + 1}` : 'Krise'}
        value={eigen ? EIGENE_KRISE_ID : a.id}
        optionen={KRISEN_KATALOG_OPTIONEN}
        onChange={(id) =>
          setze((x) =>
            id === EIGENE_KRISE_ID
              ? { ...x, id, land: 'CHE', eigen: x.eigen ?? standardEigeneKrise() }
              : { ...x, id, land: kriseNach(id)?.land ?? x.land, eigen: null },
          )
        }
      />
      {krise && schwere ? (
        <KriseSchwereInfo
          kriseId={krise.id}
          kriseName={krise.name}
          standardLand={krise.land}
          land={land}
          s={schwere}
          folge={folge}
        />
      ) : null}
      {krise ? <p className="klein">{krise.beschreibung}</p> : null}
      {eigene ? (
        <>
          <TextFeld
            label="Bezeichnung"
            maxLength={40}
            value={typeof a.eigen?.name === 'string' ? a.eigen.name : eigene.name}
            onChange={(name) => setEigen({ name: filterKrisenName(name) })}
            hinweis="Erscheint an den Krisenbändern. Höchstens 40 Zeichen."
          />
          <ZahlFeld
            label="Realer Rückgang"
            prozent
            nachkomma={0}
            value={-eigene.rueckgang}
            min={0.05}
            max={0.8}
            onChange={(v) => setEigen({ rueckgang: -v })}
            hinweis="Rückgang des ganzen Wertschriftenportfolios, real. Keine historische Zahl, sondern Ihre Annahme."
          />
          <div className="raster">
            <ZahlFeld
              label="Dauer des Rückgangs"
              value={eigene.dauer}
              min={1}
              max={8}
              nachkomma={0}
              einheit="Jahre"
              onChange={(dauer) => setEigen({ dauer: Math.round(dauer) })}
            />
            <ZahlFeld
              label="Erholung"
              value={eigene.erholung}
              min={0}
              max={15}
              nachkomma={0}
              einheit="Jahre"
              onChange={(erholung) => setEigen({ erholung: Math.round(erholung) })}
              hinweis="Jahre, bis der reale Stand vor der Krise wieder erreicht ist. 0 = der Stand bleibt unten."
            />
          </div>
          <p className="klein">
            Modell, nicht Geschichte: der Rückgang verteilt sich gleichmässig auf die Dauer, die Erholung holt den
            realen Stand wieder auf. Teuerung, Bargeld und Hauspreise bleiben Ihre Annahmen. Anlagekosten werden wie
            sonst abgezogen.
          </p>
        </>
      ) : null}
      {krise ? (
        <AuswahlFeld<KrisenLand>
          label="Daten aus"
          value={lander.includes(land) ? land : krise.land}
          optionen={lander.map((l) => ({ value: l, label: LAND_NAMEN[l] }))}
          onChange={(neu) => setze((x) => ({ ...x, land: neu }))}
        />
      ) : null}
      <Segmente<KrisenAuswahl['startArt']>
        label="Beginn"
        value={a.startArt}
        optionen={[
          { value: 'jahr', label: 'Kalender\u00adjahr' },
          { value: 'alter', label: 'Alter' },
          { value: 'nachRuecktritt', label: 'Nach Rücktritt' },
        ]}
        onChange={(startArt) => setze((x) => ({ ...x, startArt }))}
      />
      {a.startArt === 'jahr' ? (
        <ZahlFeld
          label="Startjahr"
          hinweis={`Zulässig ${Math.max(1900, fenster.von - KRISEN_START_VORLAUF)}–${fenster.bis}. Ein Beginn vor ${fenster.von} zählt mit, sobald ein Krisenjahr im Horizont liegt. ${alterAmJahresende(a.jahr, h.personen, namen)}`}
          value={a.jahr}
          min={Math.max(1900, fenster.von - KRISEN_START_VORLAUF)}
          max={fenster.bis}
          nachkomma={0}
          gruppieren={false}
          onChange={(jahr) =>
            setze((x) => ({
              ...x,
              jahr: Math.min(fenster.bis, Math.max(1900, fenster.von - KRISEN_START_VORLAUF, Math.round(jahr))),
            }))
          }
        />
      ) : a.startArt === 'alter' ? (
        <>
          {h.personen.length > 1 ? (
            <AuswahlFeld<string>
              label="Alter von"
              value={String(a.person)}
              optionen={h.personen.map((_p, j) => ({ value: String(j), label: namen[j] ?? '' }))}
              onChange={(v) => setze((x) => ({ ...x, person: Number(v) }))}
            />
          ) : null}
          <ZahlFeld
            label="Alter bei Krisenbeginn"
            hinweis={`Die Krise beginnt im Kalenderjahr, in dem ${namen[a.person] ?? namen[0]} dieses Alter erreicht${startJahr ? ` (${startJahr})` : ''}.`}
            value={a.alter}
            min={0}
            max={130}
            nachkomma={0}
            einheit="Jahre"
            onChange={(v) => setze((x) => ({ ...x, alter: Math.round(v) }))}
          />
        </>
      ) : (
        <ZahlFeld
          label="Jahre nach dem Rücktritt"
          hinweis={`0 = im Jahr des Rücktritts von ${erwName ?? 'der erwerbstätigen Person'}${startJahr ? ` (${startJahr})` : ''}.`}
          value={a.jahreNach}
          min={JAHRE_NACH_MIN}
          max={JAHRE_NACH_MAX}
          nachkomma={0}
          einheit="Jahre"
          onChange={(j) => setze((x) => ({ ...x, jahreNach: Math.round(j) }))}
        />
      )}
      <AuswahlFeld<number>
        label="Monat"
        hinweis={
          a.startArt === 'jahr'
            ? 'Januar rechnet das ganze Startjahr. Ab Februar wird die Jahresrendite geometrisch auf diesen Monat und die Folgejahre verteilt. Das ist eine Annäherung, die Daten bleiben Jahreswerte.'
            : a.startArt === 'alter'
              ? `Monat im Kalenderjahr, in dem ${namen[a.person] ?? namen[0]} das Alter erreicht. Januar = das ganze Jahr, wie bisher.`
              : 'Monat im Kalenderjahr des Abstands zum Rücktritt. Januar = das ganze Jahr, wie bisher. Nicht die Monate seit dem Rücktrittsdatum.'
        }
        value={monat}
        optionen={MONATE}
        onChange={(v) => setze((x) => ({ ...x, monat: v }))}
      />
      {krise && dd !== null && teuerungMix !== null ? (
        <p className="klein">
          {krise.kurz} beginnt {monat > 1 ? `im ${monatName} ${beginn}` : beginn}
          {startJahr ? ` (${alterAmJahresende(startJahr, h.personen, namen).replace(/\.$/, '')})` : ''}. Ihr Mix (
          {fmtProzent(h.annahmen.aktienanteil, 0)} Aktien) verliert in den Katalogjahren real bis zu{' '}
          <strong>{fmtProzent(-dd, 0)}</strong>, Teuerung total {fmtProzent(teuerungMix, 0)}. Quelle: JST Macrohistory
          R6, Schweiz ab 2021 SNB und BFS.
        </p>
      ) : eigene ? (
        <p className="klein">
          {eigene.name} beginnt {monat > 1 ? `im ${monatName} ${beginn}` : beginn}
          {startJahr ? ` (${alterAmJahresende(startJahr, h.personen, namen).replace(/\.$/, '')})` : ''}. Realer Rückgang{' '}
          {fmtProzent(-eigene.rueckgang, 0)} über {eigene.dauer} {eigene.dauer === 1 ? 'Jahr' : 'Jahre'}
          {eigene.erholung > 0
            ? `, Erholung ${eigene.erholung} ${eigene.erholung === 1 ? 'Jahr' : 'Jahre'}`
            : ', ohne Erholung'}
          .
        </p>
      ) : null}
      <button type="button" className="knopf knopf--sekundaer" onClick={entfernen}>
        Krise entfernen
      </button>
    </div>
  );
}

export function AktienanteilFeld({ h, setH }: { h: Haushalt; setH: Setzer }) {
  return (
    <ZahlFeld
      label="Aktienanteil Ihrer Wertschriften"
      hinweis="Ihre Annahme; der Rest gilt als Obligationen. Nur für Krisen und Monte Carlo."
      value={h.annahmen.aktienanteil}
      prozent
      nachkomma={0}
      min={0}
      max={1}
      onChange={(v) => setH((x) => ({ ...x, annahmen: { ...x.annahmen, aktienanteil: v } }))}
    />
  );
}

/** Historische Krisenhäufigkeit pro Dekade (JST R6, eigene Auszählung). */
export function HaeufigkeitTabelle() {
  const ganz = '1871-2020';
  const neu = '1950-2020';
  const land = (iso: string, p: string) => HAEUFIGKEIT.laender[iso]?.[p];
  const welt = (p: string) => HAEUFIGKEIT.welt[p]?.mittelLaender;
  const zeilen: { label: string; werte: (p: string) => [number, number, number] | null }[] = [
    {
      label: 'Schweiz',
      werte: (p) => {
        const x = land('CHE', p);
        return x ? [x.real20.proDekade, x.real30.proDekade, x.banken.proDekade] : null;
      },
    },
    {
      label: 'USA',
      werte: (p) => {
        const x = land('USA', p);
        return x ? [x.real20.proDekade, x.real30.proDekade, x.banken.proDekade] : null;
      },
    },
    {
      label: 'Ø 18 Länder',
      werte: (p) => {
        const x = welt(p);
        return x ? [x.real20, x.real30, x.banken] : null;
      },
    },
  ];
  return (
    <details className="aufklapp-innen">
      <summary>Wie oft gab es Krisen? (pro 10 Jahre)</summary>
      {[ganz, neu].map((p) => (
        <ScrollTabelle
          key={p}
          label={
            p === ganz
              ? 'Krisenhäufigkeit, ganze Periode (Tabelle, scrollbar)'
              : 'Krisenhäufigkeit seit 1950 (Tabelle, scrollbar)'
          }
        >
          <table>
            <caption>{p === ganz ? 'Ganze Periode (Aktien Schweiz ab 1900, USA ab 1872)' : 'Seit 1950'}</caption>
            <thead>
              <tr>
                <th scope="col">Pro Dekade</th>
                <th scope="col">Aktien real −20 %</th>
                <th scope="col">Aktien real −30 %</th>
                <th scope="col">Bankenkrisen</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => {
                const w = z.werte(p);
                return (
                  <tr key={z.label}>
                    <th scope="row">{z.label}</th>
                    <td>{w ? fmtDek(w[0]) : '–'}</td>
                    <td>{w ? fmtDek(w[1]) : '–'}</td>
                    <td>{w ? fmtDek(w[2]) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTabelle>
      ))}
      <p className="klein">
        Gezählt: Der reale Aktien-Gesamtertragsindex (mit Dividenden, nach Teuerung, Jahresendwerte) fällt um mindestens
        20 % bzw. 30 % unter den letzten Höchststand; eine Krise endet mit einem neuen Höchststand. Bankenkrisen: Beginn
        einer systemischen Bankenkrise nach Jordà-Schularick-Taylor (Variable crisisJST). Ø 18 Länder: Durchschnitt der
        Länder der JST-Datenbank. Jahresdaten zeigen kurze Einbrüche nicht, die Zahlen sind eher Untergrenzen. Quelle:
        JST Macrohistory Database R6, eigene Auszählung, Stand {fmtStand(HAEUFIGKEIT.stand)}.
      </p>
      <p className="klein">
        Faustregel: In der Schweiz fielen Aktien real etwa alle 12 bis 14 Jahre um 20 % oder mehr (0.74 bzw. 0.85 pro
        Dekade), im Durchschnitt der 18 Länder etwa alle 16 bis 20 Jahre. Einbrüche von 30 % oder mehr: Schweiz etwa
        alle 20 Jahre, 18 Länder etwa alle 22 bis 28 Jahre.
      </p>
    </details>
  );
}

interface McProps {
  h: Haushalt;
  setH: Setzer;
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  refIdx: number;
  namen: string[];
  /** true: der Aktienanteil steht oben bei den Krisen. false: im Schritt Annahmen. */
  aktienanteilHier: boolean;
}

export function MonteCarloKarte({ h, setH, effH, heute, refIdx, namen, aktienanteilHier }: McProps) {
  const k = h.krisen;
  const rate = k.mcKrisenProDekade ?? STANDARD_KRISEN_PRO_DEKADE;
  // Objekt nur bei echter Änderung neu bilden, sonst würde die Rechnung bei jeder Darstellung neu starten
  const eingabeJetzt = useMemo(() => ({ effH, k, rate }), [effH, k, rate]);
  const eingabe = useDeferredValue(eingabeJetzt);
  const einstellung = useMemo<McEinstellung | null>(
    () =>
      eingabe.k.mcAktiv
        ? {
            art: eingabe.k.mcArt,
            laeufe: eingabe.k.mcLaeufe,
            seed: 20260927,
            krisenProDekade: eingabe.rate,
            blockLaenge: eingabe.k.mcBlockLaenge,
            bootstrapLand: 'CHE',
          }
        : null,
    [eingabe],
  );
  // Läuft im Web-Worker (Ersatz im Hauptthread ohne Worker): Oberfläche bleibt bedienbar, Fortschritt und Abbruch
  const mcStand = useVollMc(eingabe.effH, heute, einstellung);
  const erg = mcStand.ergebnis;

  const x = useMemo(() => {
    if (!erg) return null;
    const geb = effH.personen[refIdx]?.geburtsjahr ?? 0;
    return erg.jahre.map((j) => j - geb);
  }, [erg, effH, refIdx]);
  const dar = darstellungVon(h);
  const fortschrittId = useId();

  return (
    <Karte
      titel="Wiederkehrende Krisen (Monte Carlo)"
      untertitel="Realistischer: Krisen kommen immer wieder, niemand weiss wann. Die App rechnet Ihren Wunsch-Rücktritt viele Male mit zufällig verteilten Krisen durch."
    >
      <Schalter
        label="Monte-Carlo-Rechnung anzeigen"
        checked={k.mcAktiv}
        onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcAktiv: v }))}
      />
      {k.mcAktiv ? (
        <>
          <Segmente<'wiederkehrend' | 'bootstrap'>
            label="Methode"
            value={k.mcArt}
            optionen={[
              { value: 'wiederkehrend', label: 'Ihre Annahmen + Krisen' },
              { value: 'bootstrap', label: 'Nur Geschichte Schweiz' },
            ]}
            onChange={(mcArt) => setzeKrisen(setH, (kr) => ({ ...kr, mcArt }))}
          />
          {k.mcArt === 'wiederkehrend' ? (
            <ZahlFeld
              label="Zufällige Krisen pro 10 Jahre"
              hinweis={`Standard ${fmtDek(STANDARD_KRISEN_PRO_DEKADE)}: so oft fielen Schweizer Aktien real um 20 % oder mehr (1900–2020, JST). Gezogen wird zufällig eine der «normalen» Krisen. Eigene Häufigkeit, unabhängig von «Krisen pro 10 Jahre» bei Automatisch.`}
              value={rate}
              min={0}
              max={10}
              nachkomma={2}
              onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcKrisenProDekade: v }))}
            />
          ) : (
            <ZahlFeld
              label="Blocklänge"
              hinweis="Es werden zusammenhängende Jahresblöcke aus der Schweizer Geschichte 1900–2024 gezogen (Aktien, Obligationen, Geldmarkt, Teuerung). Ihre Renditeannahme gilt hier nicht."
              value={k.mcBlockLaenge}
              min={1}
              max={20}
              nachkomma={0}
              einheit="Jahre"
              onChange={(v) => setzeKrisen(setH, (kr) => ({ ...kr, mcBlockLaenge: Math.round(v) }))}
            />
          )}
          <p className="klein">
            Aktienanteil {fmtProzent(h.annahmen.aktienanteil, 0)}.{' '}
            {aktienanteilHier
              ? 'Ändern Sie ihn oben bei den Krisen in «Was wäre, wenn».'
              : 'Ändern Sie ihn im Schritt «Annahmen».'}
          </p>
          {mcStand.laeuft ? (
            <div className="mc-fortschritt" role="status">
              <label htmlFor={fortschrittId}>Monte Carlo rechnet … {Math.round(mcStand.fortschritt * 100)} %</label>
              <progress id={fortschrittId} max={1} value={mcStand.fortschritt} />
              <button type="button" className="knopf knopf--sekundaer" onClick={mcStand.abbrechen}>
                Abbrechen
              </button>
            </div>
          ) : null}
          {mcStand.abgebrochen ? (
            <p className="info" role="status">
              Die Rechnung wurde abgebrochen.{' '}
              <button type="button" className="knopf knopf--sekundaer" onClick={mcStand.neuStarten}>
                Erneut rechnen
              </button>
            </p>
          ) : null}
          {mcStand.fehler ? (
            <p className="warnung" role="alert">
              Die Monte-Carlo-Rechnung ist fehlgeschlagen: {mcStand.fehler}
            </p>
          ) : null}
          {erg ? (
            <>
              <div className="kennzahlen" role="status">
                <div>
                  <span className="kennzahl__wert">{fmtProzent(erg.erfolgsquote, 0)}</span>
                  <span className="kennzahl__text">
                    Erfolgs­wahrscheinlichkeit: Das Geld reicht bis zum Planungsalter
                  </span>
                </div>
                <div>
                  <span className="kennzahl__wert">
                    {erg.reichtBisAlterP10 === null ? `${h.planungsalter}+` : erg.reichtBisAlterP10}
                  </span>
                  <span className="kennzahl__text">Bis zu diesem Alter reicht das Geld in 9 von 10 Fällen</span>
                </div>
              </div>
              {x ? (
                <Faecher
                  m={erg}
                  x={x}
                  xLabel={h.personen.length > 1 ? `Alter ${namen[refIdx]}` : 'Alter'}
                  darstellung={dar}
                  planungsalter={effH.planungsalter}
                />
              ) : null}
              <p className="klein">
                {erg.laeufe} Läufe
                {k.mcArt === 'wiederkehrend' ? `, im Schnitt ${fmtDek(erg.krisenMittel)} Krisen pro Lauf` : ''}. Werte{' '}
                {inFranken(dar)}
                {dar === 'nominal' ? ' (jeder Lauf mit seiner eigenen Teuerung umgerechnet)' : ''}. Bei «Ihre Annahmen +
                Krisen» ersetzen die Krisenjahre Ihre Annahme; die normalen Jahre sind so erhöht, dass im Erwartungswert
                über Ihren Planungszeitraum (Krisen am Ende abgeschnitten) Ihre Annahme herauskommt (keine
                Doppelzählung).
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </Karte>
  );
}
