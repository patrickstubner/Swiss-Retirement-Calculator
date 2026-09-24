/**
 * «Frühestes Rücktrittsalter»: kleinstes Stopp-Alter, bei dem das freie Vermögen bis zum
 * Planungsalter nie negativ wird. Jährlicher Scan, danach monatliche Verfeinerung.
 * Linearer Scan statt Bisektion, weil der Erfolg wegen Stufen (z.B. PK-Mindestalter,
 * NE-Beiträge) nicht streng monoton sein muss.
 */
import type { Regeln } from '../rules';
import { monatIndex } from './ahv';
import { geburtIndex, type SimOptionen, simuliere } from './simulation';
import type { Haushalt, SimulationsErgebnis } from './typen';

export interface SolverOptionen extends Omit<SimOptionen, 'stoppAlterMonate'> {
  /** 'gemeinsam': alle hören am selben Datum auf; 'person': nur `person` variiert */
  modus: 'gemeinsam' | 'person';
  /** Referenzperson (Index), deren Alter gesucht wird */
  person: number;
  /** Obergrenze der Suche (Jahre) */
  maxAlter: number;
}

export interface SolverErgebnis {
  gefunden: boolean;
  /** Stopp-Alter der Referenzperson in Monaten */
  alterMonate: number | null;
  /** Stopp-Alter aller Personen in Monaten */
  stoppAlterMonate: number[] | null;
  /** true, wenn sofortiger Rücktritt bereits reicht */
  sofort: boolean;
  ergebnis: SimulationsErgebnis | null;
  simulationen: number;
}

export function fruehestesRuecktrittsalter(h: Haushalt, regeln: Regeln, opt: SolverOptionen): SolverErgebnis {
  const refP = h.personen[opt.person];
  if (!refP) throw new Error('Ungültige Referenzperson');
  const refGeb = geburtIndex(refP);
  const aktuellM = Math.max(0, monatIndex(opt.start) - refGeb);
  const maxM = Math.max(aktuellM, opt.maxAlter * 12);
  let simulationen = 0;

  const stoppFuer = (a: number): number[] =>
    h.personen.map((p, i) => {
      if (i === opt.person) return a;
      if (opt.modus === 'gemeinsam') return a + refGeb - geburtIndex(p);
      return Math.round(p.stoppAlter * 12);
    });
  const teste = (a: number): SimulationsErgebnis => {
    simulationen++;
    return simuliere(h, regeln, { ...opt, stoppAlterMonate: stoppFuer(a) });
  };

  const treffer = (a: number, e: SimulationsErgebnis): SolverErgebnis => ({
    gefunden: true,
    alterMonate: a,
    stoppAlterMonate: stoppFuer(a),
    sofort: a === aktuellM,
    ergebnis: e,
    simulationen,
  });

  const sofort = teste(aktuellM);
  if (sofort.erfolg) return treffer(aktuellM, sofort);

  let vorher = aktuellM;
  for (let a = (Math.floor(aktuellM / 12) + 1) * 12; a <= maxM; a += 12) {
    const e = teste(a);
    if (e.erfolg) {
      for (let b = vorher + 1; b < a; b++) {
        const eb = teste(b);
        if (eb.erfolg) return treffer(b, eb);
      }
      return treffer(a, e);
    }
    vorher = a;
  }
  return { gefunden: false, alterMonate: null, stoppAlterMonate: null, sofort: false, ergebnis: null, simulationen };
}
