/**
 * Darstellung «Nominal (mit Teuerung)»: Die Simulation rechnet real (heutige Franken). Für die Anzeige in
 * Franken des jeweiligen Jahres wird jeder Betrag mit der kumulierten Teuerung seines Jahres multipliziert
 * (`JahresZeile.indexBeginn` für Flüsse, `indexEnde` für Bestände am 31.12.). Der Index stammt aus dem
 * gerechneten Pfad: Teuerungsannahme, in Krisenjahren die historische Teuerung, in Monte-Carlo-Läufen die
 * Teuerung des jeweiligen Laufs. Das erste, angebrochene Jahr zählt wie in der Rechnung als ganzes Jahr.
 */
import type { JahresZeile, Monat, PersonInfo, SimulationsErgebnis, TodesfallInfo, Toepfe } from './typen';

export type Darstellung = 'real' | 'nominal';

/** Index zu Beginn bzw. am Ende eines Kalenderjahres (ausserhalb des Horizonts: erster bzw. letzter Wert). */
export function teuerungsIndex(e: SimulationsErgebnis, jahr: number, art: 'beginn' | 'ende' = 'beginn'): number {
  const z = e.zeilen.find((x) => x.jahr === jahr);
  if (z) return art === 'beginn' ? z.indexBeginn : z.indexEnde;
  const erste = e.zeilen[0];
  const letzte = e.zeilen.at(-1);
  if (!erste || !letzte) return 1;
  return jahr < erste.jahr ? 1 : letzte.indexEnde;
}

const mal = (t: Toepfe, f: number): Toepfe => ({
  bargeld: t.bargeld * f,
  wertschriften: t.wertschriften * f,
  sonstiges: t.sonstiges * f,
  wohneigentum: t.wohneigentum * f,
  pk: t.pk * f,
  freizuegigkeit: t.freizuegigkeit * f,
  saeule3a: t.saeule3a * f,
});

/** Jahreszeile in Franken des jeweiligen Jahres. */
export function nominalZeile(z: JahresZeile): JahresZeile {
  const f = z.indexBeginn;
  const b = z.indexEnde;
  return {
    ...z,
    lohn: z.lohn * f,
    ahv: z.ahv * f,
    pkRente: z.pkRente * f,
    auslandRenten: z.auslandRenten * f,
    weitereEinnahmen: z.weitereEinnahmen * f,
    einmalig: z.einmalig * f,
    kapitalBezuege: z.kapitalBezuege * f,
    sozialabgaben: z.sozialabgaben * f,
    neBeitraege: z.neBeitraege * f,
    freiwilligeAhv: z.freiwilligeAhv * f,
    steuernEinkommen: z.steuernEinkommen * f,
    steuernKapital: z.steuernKapital * f,
    steuernVermoegen: z.steuernVermoegen * f,
    ausgaben: z.ausgaben * f,
    lebenshaltung: z.lebenshaltung * f,
    // Nominaler Ertrag = Endbestand nominal − Anfangsbestand nominal (Wachstum inkl. Teuerung)
    ertraege: (z.ertragsBasis + z.ertraege) * b - z.ertragsBasis * f,
    ertragsBasis: z.ertragsBasis * f,
    sparbeitraegeVorsorge: z.sparbeitraegeVorsorge * f,
    saldo: z.saldo * f,
    wohnkosten: z.wohnkosten * f,
    mieteinnahmen: z.mieteinnahmen * f,
    // Verkauf wird am Jahresende verbucht (wie in der Simulation)
    grundstueckgewinnsteuer: z.grundstueckgewinnsteuer * b,
    verkaufserloes: z.verkaufserloes * b,
    toepfe: mal(z.toepfe, b),
    toepfeProPerson: z.toepfeProPerson.map((t) => mal(t, b)),
    verfuegbar: z.verfuegbar * b,
    gebunden: z.gebunden * b,
    fehlbetrag: z.fehlbetrag * b,
    vermoegen: z.vermoegen * b,
    total: z.total * b,
    pkGuthaben: z.pkGuthaben * b,
    saeule3aGuthaben: z.saeule3aGuthaben * b,
  };
}

function nominalInfo(e: SimulationsErgebnis, p: PersonInfo): PersonInfo {
  const ix = (m: Monat) => teuerungsIndex(e, m.jahr);
  const jahre = (xs: { jahr: number; betrag: number }[]) =>
    xs.map((x) => ({ ...x, betrag: x.betrag * teuerungsIndex(e, x.jahr) }));
  const bar = p.barauszahlung;
  const fBar = bar ? ix(bar.monat) : 1;
  const pkMonat = bar && (bar.pk > 0 || bar.pkGesperrt > 0) ? bar.monat : p.pkStart;
  return {
    ...p,
    ahvRenteMonatStart: p.ahvRenteMonatStart * ix(p.ahvStart),
    pkRenteJahr: p.pkRenteJahr * ix(p.pkStart),
    pkKapital: p.pkKapital * ix(pkMonat),
    saeule3aKapital: p.saeule3aKapital * ix(p.saeule3aStart),
    freizuegigkeitKapital: p.freizuegigkeitKapital * ix(p.freizuegigkeitStart),
    freiwilligeAhvJahre: jahre(p.freiwilligeAhvJahre),
    neBeitraegeJahre: jahre(p.neBeitraegeJahre),
    barauszahlung: bar
      ? {
          ...bar,
          pk: bar.pk * fBar,
          pkGesperrt: bar.pkGesperrt * fBar,
          freizuegigkeit: bar.freizuegigkeit * fBar,
          saeule3a: bar.saeule3a * fBar,
        }
      : null,
    // Summe, fällt fast ganz bei der Barauszahlung an: mit deren Index umgerechnet (Näherung)
    quellensteuerKapital: p.quellensteuerKapital * fBar,
    zielland: p.zielland
      ? {
          ...p.zielland,
          steuer: p.zielland.steuer * teuerungsIndex(e, p.zielland.jahr),
          quellensteuerRente: p.zielland.quellensteuerRente * teuerungsIndex(e, p.zielland.jahr),
          einkommen: p.zielland.einkommen * teuerungsIndex(e, p.zielland.jahr),
        }
      : null,
    verkauf: p.verkauf
      ? (() => {
          const f = teuerungsIndex(e, p.verkauf.monat.jahr, 'ende');
          return {
            ...p.verkauf,
            preis: p.verkauf.preis * f,
            hypothek: p.verkauf.hypothek * f,
            steuer: p.verkauf.steuer * f,
            erloes: p.verkauf.erloes * f,
          };
        })()
      : null,
  };
}

/** Beträge des Todesfalls (Rente pro Monat/Jahr, Abfindung, Kapital) mit der Teuerung des Todesjahres. */
function nominalTodesfall(e: SimulationsErgebnis, t: TodesfallInfo): TodesfallInfo {
  const f = teuerungsIndex(e, t.jahr);
  return {
    ...t,
    ahvWitwenrenteMonat: t.ahvWitwenrenteMonat * f,
    ahvAltersrenteMonat: t.ahvAltersrenteMonat * f,
    pkEhegattenrenteJahr: t.pkEhegattenrenteJahr * f,
    pkAbfindung: t.pkAbfindung * f,
    kapitalFzUnd3a: t.kapitalFzUnd3a * f,
  };
}

/** Ganzes Ergebnis in Franken des jeweiligen Jahres (für die Anzeige; die Rechnung bleibt real). */
export function nominalErgebnis(e: SimulationsErgebnis): SimulationsErgebnis {
  const letzte = e.zeilen.at(-1);
  return {
    ...e,
    zeilen: e.zeilen.map(nominalZeile),
    endVermoegen: e.endVermoegen * (letzte?.indexEnde ?? 1),
    personen: e.personen.map((p) => nominalInfo(e, p)),
    ...(e.todesfall ? { todesfall: nominalTodesfall(e, e.todesfall) } : {}),
  };
}

/** Ergebnis in der gewählten Darstellung. */
export function inDarstellung(e: SimulationsErgebnis, d: Darstellung): SimulationsErgebnis {
  return d === 'nominal' ? nominalErgebnis(e) : e;
}
