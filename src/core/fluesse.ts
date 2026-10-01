/**
 * Aufstellung der Zu- und Abflüsse («was fliesst wann und warum zu bzw. ab»).
 *
 * Reine Logik auf den Jahreszeilen der Simulation (`JahresZeile`), ohne eigene Finanzrechnung:
 * - Pro Jahr: Zuflüsse (laufende Einnahmen, Kapital, Erträge), Abflüsse (Ausgaben, Steuern, Abgaben) und
 *   die Veränderung des Vermögens (`vermoegen` = Bargeld + Wertschriften + Sonstiges + Wohneigentum
 *   − Fehlbetrag; ohne gesperrte PK/FZ/3a).
 * - Bilanz (heutige Franken): Σ Zuflüsse − Σ Abflüsse = Δ Vermögen. Hausverkauf ist eine Umschichtung
 *   (Nettowert Haus → Wertschriften), der Vermögensabfluss sind nur Verkaufskosten und Grundstückgewinnsteuer.
 *   In der nominalen Darstellung bleibt eine rechnerische Umrechnungsposition (Teuerung auf dem Bestand).
 * - Zeitleiste der Ereignisse (Kapital, Renten, Wegzug, Hausverkauf) mit Datum, Betrag und Quelle.
 * - Entnahmerate: Nettoentnahme aus dem Vermögen im Verhältnis zum investierten bzw. gesamten Vermögen.
 * Alle Beträge stehen in der Währung der übergebenen Zeilen (real oder nominal, je nach `inDarstellung`).
 */
import { auslandRenteRealJahr } from './auslandRenten';
import { realerBetrag } from './indexierung';
import type { Darstellung } from './nominal';
import { teuerungsIndex } from './nominal';
import type { Haushalt, JahresZeile, Monat, Person, SimulationsErgebnis, Toepfe } from './typen';
import { geburtIndex } from './zeitpunkt';

export type ZuflussId =
  | 'lohn'
  | 'ahv'
  | 'pkRente'
  | 'auslandRenten'
  | 'weitereEinnahmen'
  | 'mieteinnahmen'
  | 'kapitalPk'
  | 'kapitalFz'
  | 'kapital3a'
  | 'kapitalTod'
  | 'einmalig'
  | 'ertraege'
  | 'wohnwert';

export type AbflussId =
  | 'lebenshaltung'
  | 'wohnkosten'
  | 'krankenkasse'
  | 'sonstigeAusgaben'
  | 'stEinkommen'
  | 'stKapital'
  | 'stVermoegen'
  | 'stGrundstueck'
  | 'verkaufskosten'
  | 'abgaben'
  | 'vorsorgeSparen'
  | 'einmalig'
  | 'kursverlust'
  | 'wohnwertVerlust';

export interface PostenInfo {
  label: string;
  /** Was ist das? */
  was: string;
  /** Wann fällt es an? */
  wann: string;
  /** Warum? */
  warum: string;
}

export const ZUFLUSS_INFO: Record<ZuflussId, PostenInfo & { art: 'laufend' | 'kapital' | 'vermoegen' }> = {
  lohn: {
    art: 'laufend',
    label: 'Erwerbseinkommen (brutto)',
    was: 'Lohn vor Abzug von Sozialabgaben und Vorsorgebeiträgen.',
    wann: 'Bis zur Erwerbsaufgabe.',
    warum: 'Die Abzüge stehen bei den Abflüssen.',
  },
  ahv: {
    art: 'laufend',
    label: 'AHV-Renten',
    was: 'Altersrenten (inkl. 13. Rente) aller Personen, bei Paaren nach Plafonierung.',
    wann: 'Ab dem AHV-Bezug jeder Person (Referenzalter, Vorbezug oder Aufschub).',
    warum: 'Gesetzliche Altersvorsorge; bei Auslandwohnsitz hängt die Höhe von den Beitragsjahren ab.',
  },
  pkRente: {
    art: 'laufend',
    label: 'PK-Renten',
    was: 'Rente aus der Pensionskasse (Umwandlungssatz × Guthaben), nominal fix.',
    wann: 'Ab dem PK-Bezug, sofern nicht alles als Kapital bezogen wird.',
    warum: 'Ersetzt das gesperrte PK-Guthaben, das deshalb aus der Vermögensgrafik verschwindet.',
  },
  auslandRenten: {
    art: 'laufend',
    label: 'Ausländische Renten (netto)',
    was: 'Renten aus dem Ausland nach Steuer im Quellenstaat.',
    wann: 'Ab dem erfassten Startalter.',
    warum: 'Wie im Modell erfasst.',
  },
  weitereEinnahmen: {
    art: 'laufend',
    label: 'Weitere Einnahmen',
    was: 'Wiederkehrende Posten ohne Miete, z.B. Nebeneinkommen.',
    wann: 'Zwischen Start- und Endalter des Postens.',
    warum: 'Wie im Modell erfasst.',
  },
  mieteinnahmen: {
    art: 'laufend',
    label: 'Mieteinnahmen',
    was: 'Miete einer vermieteten Liegenschaft bzw. Miet-Posten.',
    wann: 'Solange vermietet.',
    warum: 'Wie im Modell erfasst.',
  },
  kapitalPk: {
    art: 'kapital',
    label: 'PK-Kapital',
    was: 'Barauszahlung beim Wegzug oder Kapitalbezug bei der Pensionierung.',
    wann: 'Bei Wegzug vor dem PK-Bezugsalter; sonst ab dem Bezugsalter.',
    warum: 'Wird zu Wertschriften der Person; die Steuer darauf steht bei den Abflüssen.',
  },
  kapitalFz: {
    art: 'kapital',
    label: 'Freizügigkeit',
    was: 'Freizügigkeitsguthaben als Kapital.',
    wann: 'Ab frühestens fünf Jahre vor dem Referenzalter oder beim Wegzug.',
    warum: 'Wird zu Wertschriften der Person.',
  },
  kapital3a: {
    art: 'kapital',
    label: 'Säule 3a',
    was: 'Bezug des 3a-Guthabens.',
    wann: 'Ab frühestens fünf Jahre vor dem Referenzalter oder beim Wegzug.',
    warum: 'Wird zu Wertschriften der Person.',
  },
  kapitalTod: {
    art: 'kapital',
    label: 'Kapital aus Todesfall',
    was: 'Freizügigkeit, 3a und allfällige PK-Abfindung der verstorbenen Person.',
    wann: 'Im Todesjahr (nur im Szenario Todesfall).',
    warum: 'Geht an die überlebende Person.',
  },
  einmalig: {
    art: 'kapital',
    label: 'Einmalige Zuflüsse',
    was: 'Erfasste Einmalereignisse mit positivem Betrag, z.B. Erbschaft.',
    wann: 'Im Jahr des Ereignisses.',
    warum: 'Wie im Modell erfasst.',
  },
  ertraege: {
    art: 'vermoegen',
    label: 'Vermögenserträge',
    was: 'Zinsen, Dividenden und Kursgewinne auf Bargeld, Wertschriften und Sonstigem, nach Kosten.',
    wann: 'Jedes Jahr.',
    warum: 'Rendite der Annahmen (real: nach Abzug der Teuerung).',
  },
  wohnwert: {
    art: 'vermoegen',
    label: 'Wertzuwachs Wohneigentum',
    was: 'Preisänderung der Liegenschaft auf dem Nettowert (Verkehrswert − Hypothek).',
    wann: 'Jedes Jahr, bis zum Verkauf.',
    warum: 'Das Modell lässt Liegenschaften wie Wertschriften wachsen (Vereinfachung).',
  },
};

export const ABFLUSS_INFO: Record<AbflussId, PostenInfo> = {
  lebenshaltung: {
    label: 'Lebenshaltung',
    was: 'Geplante Ausgaben gemäss Grundbetrag, Phasen und Einzeljahren.',
    wann: 'Jedes Jahr bis zum Planungshorizont.',
    warum: 'Ihr Wunsch-Lebensstandard.',
  },
  wohnkosten: {
    label: 'Wohnkosten',
    was: 'Hypothekarzins, Unterhalt, Miete und Posten der Kategorie «Wohnen».',
    wann: 'Solange Sie wohnen bzw. die Liegenschaft halten.',
    warum: 'Nur separat ausgewiesen, wenn «Wohnkosten separat» oder Wohnen-Posten erfasst sind.',
  },
  krankenkasse: {
    label: 'Krankenkasse / Gesundheit',
    was: 'Posten der Kategorie «Gesundheit».',
    wann: 'Zwischen Start- und Endalter des Postens.',
    warum: 'Prämien und Gesundheitskosten, nicht in der Lebenshaltung enthalten.',
  },
  sonstigeAusgaben: {
    label: 'Sonstige Ausgaben',
    was: 'Weitere wiederkehrende Ausgaben-Posten.',
    wann: 'Zwischen Start- und Endalter des Postens.',
    warum: 'Wie im Modell erfasst.',
  },
  stEinkommen: {
    label: 'Steuer Einkommen',
    was: 'Einkommenssteuer Bund/Kanton/Gemeinde, bei Wohnsitz im Ausland die Steuer im Zielland und die Quellensteuer auf PK-Renten.',
    wann: 'Jedes Jahr mit steuerbarem Einkommen (Rente, Erwerb, Vermögensertrag).',
    warum: 'Renten und Erträge sind steuerbar.',
  },
  stKapital: {
    label: 'Steuer Kapitalbezug / Quellensteuer',
    was: 'Steuer auf PK-, Freizügigkeits- und 3a-Kapital; nach dem Wegzug die Schweizer Quellensteuer.',
    wann: 'Im Jahr des Kapitalbezugs.',
    warum: 'Kapitalleistungen werden getrennt vom übrigen Einkommen besteuert.',
  },
  stVermoegen: {
    label: 'Steuer Vermögen',
    was: 'Vermögenssteuer auf dem verfügbaren Vermögen inkl. Wohneigentum.',
    wann: 'Jedes Jahr, solange in der Schweiz steuerpflichtig bzw. im Zielland mit Vermögenssteuer.',
    warum: 'Kantonale Vermögenssteuer (Näherung).',
  },
  stGrundstueck: {
    label: 'Grundstückgewinnsteuer',
    was: 'Steuer auf dem Gewinn beim Hausverkauf (Verkaufspreis − Verkaufskosten − Anlagekosten).',
    wann: 'Im Jahr des Verkaufs.',
    warum: 'Wird vom Erlös abgezogen; bei Anlagekosten 0 wird der ganze Preis als Gewinn besteuert.',
  },
  verkaufskosten: {
    label: 'Verkaufskosten Haus',
    was: 'Makler, Notar u.a. als Anteil am Verkaufspreis.',
    wann: 'Im Jahr des Verkaufs.',
    warum: 'Wird vom Erlös abgezogen.',
  },
  abgaben: {
    label: 'Sozialabgaben und AHV-Beiträge',
    was: 'AHV/IV/EO/ALV auf dem Lohn, Beiträge als Nichterwerbstätige bzw. freiwillige AHV.',
    wann: 'Während des Erwerbs bzw. bis zum Referenzalter.',
    warum: 'Gesetzliche Beitragspflicht; lückenlose Beiträge sichern die volle AHV-Rente.',
  },
  vorsorgeSparen: {
    label: 'Sparbeiträge PK/3a',
    was: 'Ihr Anteil an den Beiträgen in PK und Säule 3a.',
    wann: 'Während des Erwerbs.',
    warum: 'Kein Verlust: Das Geld steht als gesperrtes Vorsorgeguthaben weiter zur Verfügung.',
  },
  einmalig: {
    label: 'Einmalige Ausgaben',
    was: 'Erfasste Einmalereignisse mit negativem Betrag.',
    wann: 'Im Jahr des Ereignisses.',
    warum: 'Wie im Modell erfasst.',
  },
  kursverlust: {
    label: 'Kursverluste / negative Erträge',
    was: 'Negative Vermögenserträge (Krisenjahre, Kosten über der Rendite).',
    wann: 'In Jahren mit negativer Rendite.',
    warum: 'Krisenszenario oder hohe Kosten.',
  },
  wohnwertVerlust: {
    label: 'Wertverlust Wohneigentum',
    was: 'Sinkender Nettowert der Liegenschaft.',
    wann: 'In Jahren mit negativer Preisänderung.',
    warum: 'Krisenszenario (Hauspreise, Hebel der Hypothek).',
  },
};

export const ZUFLUSS_IDS = Object.keys(ZUFLUSS_INFO) as ZuflussId[];
export const ABFLUSS_IDS = Object.keys(ABFLUSS_INFO) as AbflussId[];

export interface FlussJahr {
  jahr: number;
  /** Alter der Referenzperson am Jahresende */
  alter: number;
  zufluesse: Record<ZuflussId, number>;
  abfluesse: Record<AbflussId, number>;
  summeZufluss: number;
  summeAbfluss: number;
  /** Teuerung auf dem Bestand (nur nominale Darstellung; real ≈ 0) */
  umrechnung: number;
  /** Vermögen am Jahresende (ohne gesperrte Vorsorge) und Veränderung zum Vorjahr */
  vermoegenEnde: number;
  vermoegenDelta: number;
}

const nullZu = (): Record<ZuflussId, number> =>
  Object.fromEntries(ZUFLUSS_IDS.map((k) => [k, 0])) as Record<ZuflussId, number>;
const nullAb = (): Record<AbflussId, number> =>
  Object.fromEntries(ABFLUSS_IDS.map((k) => [k, 0])) as Record<AbflussId, number>;

const pos = (x: number) => (x > 0 ? x : 0);
const summe = (r: Record<string, number>) => Object.values(r).reduce((s, x) => s + x, 0);

/**
 * Zu- und Abflüsse pro Jahr. `zeilen` in der Darstellungswährung, `startVermoegen` in derselben Währung
 * (Beginn der Rechnung, Index 1). Die Bilanz geht in heutigen Franken exakt auf.
 */
export function flussJahre(zeilen: readonly JahresZeile[], startVermoegen: number, refIdx = 0): FlussJahr[] {
  let vorher = startVermoegen;
  return zeilen.map((z) => {
    const zu = nullZu();
    const ab = nullAb();
    zu.lohn = z.lohn;
    zu.ahv = z.ahv;
    zu.pkRente = z.pkRente;
    zu.auslandRenten = z.auslandRenten;
    zu.weitereEinnahmen = z.weitereEinnahmen;
    zu.mieteinnahmen = z.mieteinnahmen;
    zu.kapitalPk = z.kapitalPk;
    zu.kapitalFz = z.kapitalFz;
    zu.kapital3a = z.kapital3a;
    zu.kapitalTod = z.kapitalTod;
    zu.einmalig = pos(z.einmalig);
    zu.ertraege = pos(z.ertraege);
    zu.wohnwert = pos(z.wohnwertaenderung);

    const posten = Math.max(0, z.ausgaben - z.lebenshaltung - z.wohnkosten);
    ab.lebenshaltung = z.lebenshaltung;
    ab.wohnkosten = z.wohnkosten + z.ausgabenWohnenPosten;
    ab.krankenkasse = z.ausgabenGesundheit;
    ab.sonstigeAusgaben = Math.max(0, posten - z.ausgabenGesundheit - z.ausgabenWohnenPosten);
    ab.stEinkommen = z.steuernEinkommen;
    ab.stKapital = z.steuernKapital;
    ab.stVermoegen = z.steuernVermoegen;
    ab.stGrundstueck = z.grundstueckgewinnsteuer;
    ab.verkaufskosten = z.verkaufskosten;
    ab.abgaben = z.sozialabgaben + z.neBeitraege + z.freiwilligeAhv;
    ab.vorsorgeSparen = z.sparbeitraegeVorsorge;
    ab.einmalig = pos(-z.einmalig);
    ab.kursverlust = pos(-z.ertraege);
    ab.wohnwertVerlust = pos(-z.wohnwertaenderung);

    const delta = z.vermoegen - vorher;
    const sz = summe(zu);
    const sa = summe(ab);
    vorher = z.vermoegen;
    return {
      jahr: z.jahr,
      alter: z.alter[refIdx] ?? 0,
      zufluesse: zu,
      abfluesse: ab,
      summeZufluss: sz,
      summeAbfluss: sa,
      umrechnung: delta - (sz - sa),
      vermoegenEnde: z.vermoegen,
      vermoegenDelta: delta,
    };
  });
}

export interface Entnahmerate {
  jahr: number;
  /** Nettoentnahme aus dem Vermögen: Ausgaben, Steuern und Abgaben minus laufende Einnahmen (0 bei Überschuss) */
  entnahme: number;
  /** Investiertes Vermögen (Bargeld, Wertschriften, Sonstiges) zu Jahresbeginn plus im Jahr zufliessendes Kapital */
  investiert: number;
  /** Gesamtvermögen inkl. gesperrter Vorsorge und Wohneigentum, gleiche Zeitbasis */
  gesamt: number;
  /** Anteile (0–1); null, wenn die Bezugsgrösse 0 ist */
  rateInvestiert: number | null;
  rateGesamt: number | null;
}

/**
 * Entnahmerate pro Jahr (aus den realen Zeilen, ein Quotient ist von der Darstellung unabhängig).
 * Nettoentnahme = −Saldo des Jahres (Saldo: laufende Einnahmen − Ausgaben − Steuern − Abgaben ± Einmaliges).
 * Bezugsgrösse «investiert»: ohne gesperrte Vorsorge und ohne Wohneigentum (selbstbewohnt oder nicht),
 * zu Jahresbeginn plus die im selben Jahr zufliessenden Kapitalbezüge und den Hausverkauf-Erlös,
 * damit das Jahr der Auszahlung nicht verzerrt wird.
 */
export function entnahmeRaten(zeilen: readonly JahresZeile[], start: Toepfe): Entnahmerate[] {
  let vor = start;
  let vorFehl = 0;
  return zeilen.map((z) => {
    const invest0 = vor.bargeld + vor.wertschriften + vor.sonstiges - vorFehl;
    const gesamt0 = invest0 + vor.wohneigentum + vor.pk + vor.freizuegigkeit + vor.saeule3a;
    const zufluss = z.kapitalBezuege + z.verkaufserloes;
    const investiert = Math.max(0, invest0 + zufluss);
    const gesamt = Math.max(0, gesamt0 + zufluss);
    const entnahme = Math.max(0, -z.saldo);
    vor = z.toepfe;
    vorFehl = z.fehlbetrag;
    return {
      jahr: z.jahr,
      entnahme,
      investiert,
      gesamt,
      rateInvestiert: investiert > 0 ? entnahme / investiert : null,
      rateGesamt: gesamt > 0 ? entnahme / gesamt : null,
    };
  });
}

export interface EntnahmeKennzahl {
  /** Erstes volles Ruhestandsjahr (ohne Erwerbseinkommen) */
  jahr: number;
  erst: Entnahmerate;
  /** Durchschnitt der Raten über alle Ruhestandsjahre mit Bezugsgrösse > 0 */
  durchschnittInvestiert: number | null;
  durchschnittGesamt: number | null;
  /** Jahr mit der höchsten Rate bezogen aufs investierte Vermögen (nur Ruhestandsjahre mit Bezugsgrösse > 0) */
  hoechste: { jahr: number; rate: number } | null;
}

/** Kennzahl fürs erste volle Jahr ohne Lohn; null, wenn es kein solches Jahr gibt. */
export function entnahmeKennzahl(
  zeilen: readonly JahresZeile[],
  start: Toepfe,
  startMonat = 1,
): EntnahmeKennzahl | null {
  const raten = entnahmeRaten(zeilen, start);
  let letzterLohn = -1;
  zeilen.forEach((z, i) => {
    if (z.lohn > 0.5) letzterLohn = i;
  });
  let i0 = letzterLohn + 1;
  // Das angebrochene erste Rechnungsjahr ist kein volles Jahr
  if (i0 === 0 && startMonat > 1) i0 = 1;
  const ruhe = raten.slice(i0);
  const erst = ruhe[0];
  if (!erst) return null;
  const mittel = (f: (r: Entnahmerate) => number | null): number | null => {
    const w = ruhe.map(f).filter((x): x is number => x !== null);
    return w.length === 0 ? null : w.reduce((s, x) => s + x, 0) / w.length;
  };
  let hoechste: { jahr: number; rate: number } | null = null;
  for (const r of ruhe)
    if (r.rateInvestiert !== null && (hoechste === null || r.rateInvestiert > hoechste.rate))
      hoechste = { jahr: r.jahr, rate: r.rateInvestiert };
  return {
    jahr: erst.jahr,
    erst,
    hoechste,
    durchschnittInvestiert: mittel((r) => r.rateInvestiert),
    durchschnittGesamt: mittel((r) => r.rateGesamt),
  };
}

export type EreignisArt =
  | 'pk'
  | 'fz'
  | '3a'
  | 'todesfall'
  | 'einmalig'
  | 'hausverkauf'
  | 'wegzug'
  | 'ahv'
  | 'pkRente'
  | 'auslandRente'
  | 'posten';

export interface Ereignis {
  jahr: number;
  monat: number | null;
  art: EreignisArt;
  /** Kapital kommt zum investierten Vermögen (Zeitleiste «Kapital») bzw. laufendes Einkommen bzw. nur Marker */
  typ: 'kapital' | 'laufend' | 'marker';
  titel: string;
  /** Betrag (Kapital: einmalig; laufend: pro Jahr); null bei reinen Markern */
  betrag: number | null;
  /** Bei laufenden Einkommen: Ende (Jahr) oder null = bis zum Ende */
  bisJahr?: number | null;
  /** Steuer auf dem Ereignis (Hausverkauf: Grundstückgewinnsteuer) */
  steuer?: number;
  /** Erklärung, Quelle */
  text: string;
  /** Marker in der Vermögensgrafik */
  marker: boolean;
}

const nameVon = (p: Person, i: number) => p.name || `Person ${i + 1}`;

function monatVon(m: Monat | null | undefined, jahr: number): number | null {
  return m && m.jahr === jahr ? m.monat : null;
}

/**
 * Ereignisse für Zeitleiste und Marker. `e` muss in der Darstellung `dar` vorliegen (`inDarstellung`).
 * Kapitalbeträge stammen aus den Jahreszeilen (Summe stimmt mit der Bilanz überein), Datum und
 * Beschreibung aus den Personeninfos.
 */
export function ereignisse(e: SimulationsErgebnis, h: Haushalt, dar: Darstellung): Ereignis[] {
  const out: Ereignis[] = [];
  const erst = e.zeilen[0];
  const letzte = e.zeilen.at(-1);
  if (!erst || !letzte) return out;
  const faktor = (jahr: number) => (dar === 'nominal' ? teuerungsIndex(e, jahr) : 1);
  const infos = e.personen;
  const barJahr = (i: number) => infos[i]?.barauszahlung?.monat;

  // Kapital je Quelle und Jahr aus den Zeilen
  const quellen: [keyof JahresZeile, EreignisArt, string][] = [
    ['kapitalPk', 'pk', 'PK-Kapital'],
    ['kapitalFz', 'fz', 'Freizügigkeit'],
    ['kapital3a', '3a', 'Säule 3a'],
    ['kapitalTod', 'todesfall', 'Kapital aus Todesfall'],
  ];
  for (const z of e.zeilen) {
    for (const [feld, art, name] of quellen) {
      const betrag = z[feld] as number;
      if (!(betrag > 0.5)) continue;
      const bar = infos.findIndex((_, i) => barJahr(i)?.jahr === z.jahr);
      const istBar = art !== 'todesfall' && bar >= 0;
      let monat: number | null = null;
      if (istBar) monat = monatVon(barJahr(bar), z.jahr);
      else
        infos.forEach((info) => {
          const m = art === 'pk' ? info.pkStart : art === 'fz' ? info.freizuegigkeitStart : info.saeule3aStart;
          monat = monat ?? (art === 'todesfall' ? null : monatVon(m, z.jahr));
        });
      const steuerHinweis =
        istBar && (infos[bar]?.quellensteuerKapital ?? 0) > 0
          ? ` Schweizer Quellensteuer auf alle Kapitalbezüge nach dem Wegzug insgesamt ${Math.round(infos[bar]?.quellensteuerKapital ?? 0)} (Näherung).`
          : '';
      out.push({
        jahr: z.jahr,
        monat,
        art,
        typ: 'kapital',
        titel: istBar ? `${name}: Barauszahlung beim Wegzug` : `${name}: Bezug als Kapital`,
        betrag,
        text: `${istBar ? 'Wegzug ins Ausland: Auszahlung statt Sperrung.' : 'Ordentlicher Bezug.'} Fliesst zu den Wertschriften; die Steuer darauf steht bei den Abflüssen.${steuerHinweis}`,
        marker: true,
      });
    }
    if (z.verkaufserloes > 0.5) {
      const info = infos.map((x) => x.verkauf).find((v) => v && v.monat.jahr === z.jahr);
      out.push({
        jahr: z.jahr,
        monat: info?.monat.monat ?? null,
        art: 'hausverkauf',
        typ: 'kapital',
        titel: 'Hausverkauf: Nettoerlös in die Wertschriften',
        betrag: z.verkaufserloes,
        steuer: z.grundstueckgewinnsteuer,
        text: `Umschichtung vom Wohneigentum in Wertschriften. Verkaufspreis${info ? ` ${Math.round(info.preis)}` : ''}, abzüglich Hypothek${info ? ` ${Math.round(info.hypothek)}` : ''}, Verkaufskosten ${Math.round(z.verkaufskosten)} und Grundstückgewinnsteuer ${Math.round(z.grundstueckgewinnsteuer)}. Als Vermögensabfluss zählen nur Kosten und Steuer.`,
        marker: true,
      });
    }
  }

  // Einmalige Ereignisse (heutige Franken, nicht indexiert)
  for (const ev of h.ereignisse ?? []) {
    const p = h.personen[ev.person] ?? h.personen[0];
    if (!p) continue;
    const idx = geburtIndex(p) + Math.round(ev.alter * 12);
    const jahr = Math.floor(idx / 12);
    if (jahr < erst.jahr || jahr > letzte.jahr || ev.betrag === 0) continue;
    if (idx < erst.jahr * 12) continue;
    out.push({
      jahr,
      monat: (idx % 12) + 1,
      art: 'einmalig',
      typ: ev.betrag > 0 ? 'kapital' : 'marker',
      titel: `${ev.betrag > 0 ? 'Einmaliger Zufluss' : 'Einmalige Ausgabe'}: ${ev.bezeichnung || 'Ereignis'}`,
      betrag: ev.betrag * faktor(jahr),
      text: `Erfasstes Einmalereignis (${nameVon(p, Math.max(0, h.personen.indexOf(p)))}, Alter ${ev.alter}).`,
      marker: false,
    });
  }

  // Wegzug, AHV, PK-Rente je Person
  infos.forEach((info, i) => {
    const p = h.personen[i];
    if (!p) return;
    const name = nameVon(p, i);
    if (info.wegzug) {
      const land = p.wohnsitzAusland.land;
      out.push({
        jahr: info.wegzug.jahr,
        monat: info.wegzug.monat,
        art: 'wegzug',
        typ: 'marker',
        titel: `Wegzug ins Ausland: ${name}${land ? ` (${land})` : ''}`,
        betrag: null,
        text: 'Ab hier gelten Auslandregeln: Quellensteuer auf Kapital und PK-Rente, Steuern im Zielland, AHV nur mit Beitragsjahren bzw. freiwilliger AHV.',
        marker: true,
      });
    }
    if (info.ahvRenteMonatStart > 0) {
      out.push({
        jahr: info.ahvStart.jahr,
        monat: info.ahvStart.monat,
        art: 'ahv',
        typ: 'laufend',
        titel: `AHV-Rente ${name}`,
        betrag: info.ahvRenteMonatStart * 13,
        bisJahr: null,
        text: `${Math.round(info.ahvRenteMonatStart)} pro Monat plus 13. Rente, lebenslang (bei Paaren vor Plafonierung auf 150 %).`,
        marker: true,
      });
    }
    if (info.pkRenteJahr > 0) {
      out.push({
        jahr: info.pkStart.jahr,
        monat: info.pkStart.monat,
        art: 'pkRente',
        typ: 'laufend',
        titel: `PK-Rente ${name}`,
        betrag: info.pkRenteJahr,
        bisJahr: null,
        text: `Das PK-Guthaben wird zur Rente (Umwandlungssatz × Guthaben), nominal fix.${info.pkKapital > 0 ? ` Zusätzlich ${Math.round(info.pkKapital)} als Kapital.` : ''} Kein Verlust: Das Guthaben verschwindet aus der Vermögensgrafik und erscheint als Einkommen.`,
        marker: true,
      });
    }
    p.auslandRenten.forEach((r) => {
      const idx = geburtIndex(p) + Math.round(r.startAlter * 12);
      const jahr = Math.max(Math.floor(idx / 12), erst.jahr);
      const z = e.zeilen.find((x) => x.jahr === jahr);
      if (!z || jahr > letzte.jahr || !(r.betrag > 0)) return;
      const real = auslandRenteRealJahr(r, jahr - erst.jahr, z.indexBeginn);
      out.push({
        jahr,
        monat: Math.floor(idx / 12) < erst.jahr ? null : (idx % 12) + 1,
        art: 'auslandRente',
        typ: 'laufend',
        titel: `${r.bezeichnung || 'Ausländische Rente'} ${name}`,
        betrag: real * (dar === 'nominal' ? z.indexBeginn : 1),
        bisJahr: null,
        text: 'Brutto pro Jahr vor Steuer im Quellenstaat, umgerechnet zum angenommenen Wechselkurs.',
        marker: false,
      });
    });
  });
  for (const po of h.posten ?? []) {
    if (po.art !== 'einnahme' || !(po.betragJahr > 0)) continue;
    const p = h.personen[po.person] ?? h.personen[0];
    if (!p) continue;
    const start = geburtIndex(p) + Math.round(po.startAlter * 12);
    const jahr = Math.max(Math.floor(start / 12), erst.jahr);
    const z = e.zeilen.find((x) => x.jahr === jahr);
    if (!z || jahr > letzte.jahr) continue;
    const ende = po.endAlter === null ? null : Math.floor((geburtIndex(p) + Math.round(po.endAlter * 12)) / 12);
    const real = realerBetrag(po.betragJahr, po.indexierung, jahr - erst.jahr, z.indexBeginn);
    out.push({
      jahr,
      monat: Math.floor(start / 12) < erst.jahr ? null : (start % 12) + 1,
      art: 'posten',
      typ: 'laufend',
      titel: po.bezeichnung || 'Weitere Einnahme',
      betrag: real * (dar === 'nominal' ? z.indexBeginn : 1),
      bisJahr: ende,
      text: `Wiederkehrende Einnahme${ende === null ? ' bis zum Planungshorizont' : ''}.`,
      marker: false,
    });
  }
  return out.sort((a, b) => a.jahr - b.jahr || (a.monat ?? 0) - (b.monat ?? 0) || a.titel.localeCompare(b.titel));
}

export interface MarkerGruppe {
  jahr: number;
  nr: number;
  ereignisse: Ereignis[];
}

/** Marker der Vermögensgrafik: Ereignisse mit `marker`, je Jahr zu einer nummerierten Gruppe zusammengefasst. */
export function markerGruppen(evs: readonly Ereignis[]): MarkerGruppe[] {
  const nachJahr = new Map<number, Ereignis[]>();
  for (const ev of evs) {
    if (!ev.marker) continue;
    nachJahr.set(ev.jahr, [...(nachJahr.get(ev.jahr) ?? []), ev]);
  }
  return [...nachJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([jahr, ereignisse], i) => ({ jahr, nr: i + 1, ereignisse }));
}

export interface RentenUmwandlung {
  person: string;
  jahr: number;
  renteJahr: number;
  kapital: number;
}

/** Personen, deren PK-Guthaben in eine Rente umgewandelt wird (verschwindet aus der Grafik, kein Verlust). */
export function rentenUmwandlungen(e: SimulationsErgebnis, h: Haushalt): RentenUmwandlung[] {
  return e.personen
    .map((info, i) => ({ info, p: h.personen[i], i }))
    .filter(({ info, p }) => p !== undefined && info.pkRenteJahr > 0.5)
    .map(({ info, p, i }) => ({
      person: p ? nameVon(p, i) : `Person ${i + 1}`,
      jahr: info.pkStart.jahr,
      renteJahr: info.pkRenteJahr,
      kapital: info.pkKapital,
    }));
}

export type AbflussGruppeId =
  | 'lebenshaltung'
  | 'wohnkosten'
  | 'krankenkasse'
  | 'stEinkommen'
  | 'stKapital'
  | 'stVermoegen'
  | 'stGrundstueck'
  | 'abgaben'
  | 'sonstiges';

/**
 * Gruppen der gestapelten Grafik. Nicht enthalten: Kursverluste und Wertverlust Wohneigentum (keine Zahlungen,
 * nur in der Tabelle und der Bilanz). Die Steuern bleiben getrennt nach Art.
 */
export const ABFLUSS_GRUPPEN: { id: AbflussGruppeId; label: string; posten: AbflussId[]; erklaerung: string }[] = [
  {
    id: 'lebenshaltung',
    label: 'Lebenshaltung',
    posten: ['lebenshaltung'],
    erklaerung: ABFLUSS_INFO.lebenshaltung.was,
  },
  { id: 'wohnkosten', label: 'Wohnkosten', posten: ['wohnkosten'], erklaerung: ABFLUSS_INFO.wohnkosten.was },
  {
    id: 'krankenkasse',
    label: 'Krankenkasse',
    posten: ['krankenkasse'],
    erklaerung: ABFLUSS_INFO.krankenkasse.was,
  },
  {
    id: 'stEinkommen',
    label: 'Steuer Einkommen',
    posten: ['stEinkommen'],
    erklaerung: ABFLUSS_INFO.stEinkommen.was,
  },
  {
    id: 'stKapital',
    label: 'Steuer Kapitalbezug / Quellensteuer',
    posten: ['stKapital'],
    erklaerung: ABFLUSS_INFO.stKapital.was,
  },
  {
    id: 'stVermoegen',
    label: 'Steuer Vermögen',
    posten: ['stVermoegen'],
    erklaerung: ABFLUSS_INFO.stVermoegen.was,
  },
  {
    id: 'stGrundstueck',
    label: 'Grundstückgewinnsteuer',
    posten: ['stGrundstueck'],
    erklaerung: ABFLUSS_INFO.stGrundstueck.was,
  },
  {
    id: 'abgaben',
    label: 'Sozialbeiträge und Vorsorge-Sparen',
    posten: ['abgaben', 'vorsorgeSparen'],
    erklaerung: `${ABFLUSS_INFO.abgaben.was} Dazu die Sparbeiträge in PK und 3a (bleiben als gesperrtes Guthaben erhalten).`,
  },
  {
    id: 'sonstiges',
    label: 'Sonstiges',
    posten: ['sonstigeAusgaben', 'einmalig', 'verkaufskosten'],
    erklaerung: 'Weitere Ausgaben-Posten, einmalige Ausgaben und Verkaufskosten des Hauses.',
  },
];

/** Summe der Gruppe in einem Jahr. */
export const gruppenBetrag = (j: FlussJahr, g: (typeof ABFLUSS_GRUPPEN)[number]): number =>
  g.posten.reduce((s, id) => s + j.abfluesse[id], 0);
