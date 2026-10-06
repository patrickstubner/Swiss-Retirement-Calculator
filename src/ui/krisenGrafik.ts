/**
 * Krisenjahre eines Ergebnisses als farbige Bereiche im Vermögensverlauf (x = Alter der Referenzperson).
 * Ein Punkt im Diagramm zeigt das Vermögen am Jahresende; ein Krisenjahr J liegt deshalb zwischen
 * den Punkten der Jahre J−1 und J.
 */
import type { SimulationsErgebnis } from '../core/typen';
import { kriseNach } from '../data/krisen';
import type { Markierung } from './components/Chart';
import { MONATSNAMEN } from './format';

export interface KrisenAbschnitt extends Markierung {
  krise: string;
  name: string;
  jahrVon: number;
  jahrBis: number;
  monatVon: number;
  monatBis: number;
  /** Historisches Jahr des letzten Kalenderjahres im Abschnitt (nur fürs Zusammenziehen) */
  histJahr: number;
}

export function krisenAbschnitte(e: SimulationsErgebnis, refIdx: number): KrisenAbschnitt[] {
  const alterIn = new Map(e.zeilen.map((z) => [z.jahr, z.alter[refIdx] ?? 0]));
  const out: KrisenAbschnitt[] = [];
  for (const k of e.krisenJahre) {
    const letzte = out[out.length - 1];
    const alter = alterIn.get(k.jahr);
    if (alter === undefined) continue;
    const krise = kriseNach(k.krise);
    const neuerBeginn = krise !== undefined && k.histJahr === krise.von;
    const monatVon = k.monatVon ?? 1;
    const monatBis = k.monatBis ?? 12;
    const von = alter - 1 + (monatVon - 1) / 12;
    const bis = alter - 1 + monatBis / 12;
    // Dieselbe Krisenjahresrendite, die im Dezember noch lief und im Januar weitergeht
    // (Beginn nach Januar). Zwei volle Januar-Jahre derselben Krise bleiben getrennt.
    const fortsetzung =
      letzte !== undefined &&
      letzte.krise === k.krise &&
      letzte.jahrBis === k.jahr - 1 &&
      letzte.histJahr === k.histJahr &&
      letzte.monatBis === 12 &&
      monatVon === 1 &&
      letzte.monatVon > 1;
    if (letzte && letzte.krise === k.krise && letzte.jahrBis === k.jahr - 1 && (!neuerBeginn || fortsetzung)) {
      letzte.jahrBis = k.jahr;
      letzte.monatBis = monatBis;
      letzte.bis = bis;
      letzte.histJahr = k.histJahr;
    } else {
      const name = k.name ?? krise?.name ?? 'Krise';
      out.push({
        krise: k.krise,
        name,
        label: k.kurz ?? krise?.kurz ?? name,
        jahrVon: k.jahr,
        jahrBis: k.jahr,
        monatVon,
        monatBis,
        histJahr: k.histJahr,
        von,
        bis,
      });
    }
  }
  return out;
}

function formatAlter(x: number): string {
  const gerundet = Math.round(x * 12) / 12;
  if (Number.isInteger(gerundet)) return `${gerundet}`;
  const [ganz, bruch] = gerundet.toFixed(1).split('.');
  return `${ganz},${bruch}`;
}

function zeitspanne(k: KrisenAbschnitt): string {
  const anfang = k.monatVon > 1 ? `${MONATSNAMEN[k.monatVon - 1] ?? ''} ${k.jahrVon}`.trim() : `${k.jahrVon}`;
  const ende = k.monatBis < 12 ? `${MONATSNAMEN[k.monatBis - 1] ?? ''} ${k.jahrBis}`.trim() : `${k.jahrBis}`;
  if (k.jahrVon === k.jahrBis && k.monatVon === 1 && k.monatBis === 12) return `${k.jahrVon}`;
  if (anfang === ende) return anfang;
  return `${anfang}–${ende}`;
}

/** Text für Legende und Screenreader, z.B. «Ölkrise 2036–2037 (Alter 70–71)» */
export function krisenText(a: readonly KrisenAbschnitt[]): string {
  return a
    .map((k) => {
      // Volle Kalenderjahre: Alter am Jahresende. Beginn im Jahr: Alter an den Bandkanten.
      const startAlter = Number.isInteger(k.von) ? k.von + 1 : k.von;
      const al = startAlter === k.bis ? formatAlter(k.bis) : `${formatAlter(startAlter)}–${formatAlter(k.bis)}`;
      return `${k.label} ${zeitspanne(k)} (Alter ${al})`;
    })
    .join(', ');
}
