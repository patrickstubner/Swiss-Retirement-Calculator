/**
 * Krisenjahre eines Ergebnisses als farbige Bereiche im Vermögensverlauf (x = Alter der Referenzperson).
 * Ein Punkt im Diagramm zeigt das Vermögen am Jahresende; ein Krisenjahr J liegt deshalb zwischen
 * den Punkten der Jahre J−1 und J.
 */
import type { SimulationsErgebnis } from '../core/typen';
import { kriseNach } from '../data/krisen';
import type { Markierung } from './components/Chart';

export interface KrisenAbschnitt extends Markierung {
  krise: string;
  name: string;
  jahrVon: number;
  jahrBis: number;
}

export function krisenAbschnitte(e: SimulationsErgebnis, refIdx: number): KrisenAbschnitt[] {
  const alterIn = new Map(e.zeilen.map((z) => [z.jahr, z.alter[refIdx] ?? 0]));
  const out: KrisenAbschnitt[] = [];
  for (const k of e.krisenJahre) {
    const letzte = out[out.length - 1];
    const alter = alterIn.get(k.jahr);
    if (alter === undefined) continue;
    if (letzte && letzte.krise === k.krise && letzte.jahrBis === k.jahr - 1 && k.histJahr !== kriseNach(k.krise)?.von) {
      letzte.jahrBis = k.jahr;
      letzte.bis = alter;
    } else {
      const krise = kriseNach(k.krise);
      out.push({
        krise: k.krise,
        name: krise?.name ?? k.krise,
        label: krise?.kurz ?? k.krise,
        jahrVon: k.jahr,
        jahrBis: k.jahr,
        von: alter - 1,
        bis: alter,
      });
    }
  }
  return out;
}

/** Text für Legende und Screenreader, z.B. «Ölkrise 2036–2037 (Alter 70–71)» */
export function krisenText(a: readonly KrisenAbschnitt[]): string {
  return a
    .map((k) => {
      const j = k.jahrVon === k.jahrBis ? `${k.jahrVon}` : `${k.jahrVon}–${k.jahrBis}`;
      const al = k.von + 1 === k.bis ? `${k.bis}` : `${k.von + 1}–${k.bis}`;
      return `${k.label} ${j} (Alter ${al})`;
    })
    .join(', ');
}
