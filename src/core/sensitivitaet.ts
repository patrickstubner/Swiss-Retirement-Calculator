/**
 * «Wo sich Genauigkeit lohnt»: einfache Sensitivität der wichtigsten geschätzten bzw.
 * angenommenen Eingaben. Jede Eingabe wird um eine ungünstige Bandbreite verschoben
 * (SENSITIVITAET in schaetzwerte.ts); gemessen wird die Wirkung auf das früheste
 * Rücktrittsalter und auf das Vermögen mit 85 (jüngere Person).
 */
import type { Regeln } from '../rules';
import { type Schaetzung, SENSITIVITAET } from './schaetzwerte';
import { referenzPerson, simuliere } from './simulation';
import { fruehestesRuecktrittsalter, type SolverOptionen } from './solver';
import type { Haushalt, SimulationsErgebnis } from './typen';

export interface SensitivitaetZeile {
  id: 'ahv' | 'pkGuthaben' | 'umwandlungssatz' | 'rendite' | 'ausgaben';
  label: string;
  /** Beschreibung der Abweichung */
  variante: string;
  /** Beruht die Eingabe auf einer Schätzung/Annahme (true) oder auf einer eigenen Eingabe? */
  geschaetzt: boolean;
  /** Änderung des frühesten Rücktrittsalters in Monaten (null = nicht bestimmbar) */
  deltaAlterMonate: number | null;
  /** Änderung des Vermögens im Vergleichsalter (CHF, heutige Kaufkraft) */
  deltaVermoegen: number;
}

export interface SensitivitaetErgebnis {
  vergleichsAlter: number;
  zeilen: SensitivitaetZeile[];
}

/** Verfügbares Vermögen (abzüglich Fehlbetrag) der Referenzperson im Alter `alter`. */
export function vermoegenImAlter(h: Haushalt, e: SimulationsErgebnis, alter: number): number {
  const ref = h.personen[referenzPerson(h.personen)];
  if (!ref) return 0;
  const z = e.zeilen.find((x) => x.jahr === ref.geburtsjahr + alter) ?? e.zeilen.at(-1);
  return z ? z.vermoegen : 0;
}

export function sensitivitaet(
  h: Haushalt,
  schaetzungen: readonly Schaetzung[],
  regeln: Regeln,
  opt: Omit<SolverOptionen, 'maxAlter'> & { maxAlter?: number },
): SensitivitaetErgebnis {
  const vergleichsAlter = Math.min(85, h.planungsalter);
  const solverOpt: SolverOptionen = { ...opt, maxAlter: opt.maxAlter ?? 70 };
  const messe = (x: Haushalt) => {
    const s = fruehestesRuecktrittsalter(x, regeln, solverOpt);
    const e = simuliere(x, regeln, { start: opt.start });
    return { alter: s.gefunden ? s.alterMonate : null, vermoegen: vermoegenImAlter(x, e, vergleichsAlter) };
  };
  const basis = messe(h);
  const geschaetzt = (feld: Schaetzung['feld']) => schaetzungen.some((s) => s.feld === feld);
  const mitPersonen = (fn: (p: Haushalt['personen'][number]) => Haushalt['personen'][number]): Haushalt => ({
    ...h,
    personen: h.personen.map(fn),
  });
  const S = SENSITIVITAET;
  const bj = regeln.ahv.vollrenteBeitragsjahre;
  const varianten: {
    id: SensitivitaetZeile['id'];
    label: string;
    variante: string;
    geschaetzt: boolean;
    h: Haushalt;
  }[] = [
    {
      id: 'ahv',
      label: 'AHV-Rente (Beitragslücken, Einkommen)',
      variante: `${S.ahvFehlendeJahre} Beitragsjahre weniger`,
      geschaetzt: geschaetzt('ahvRente'),
      h: mitPersonen((p) => ({
        ...p,
        ahv: { ...p.ahv, renteMonat: (p.ahv.renteMonat * Math.max(0, bj - S.ahvFehlendeJahre)) / bj },
      })),
    },
    {
      id: 'pkGuthaben',
      label: 'PK-Altersguthaben',
      variante: `${Math.round(S.pkGuthabenRelativ * 100)}% tiefer`,
      geschaetzt: geschaetzt('pkGuthaben'),
      h: mitPersonen((p) => ({ ...p, pk: { ...p.pk, guthaben: p.pk.guthaben * (1 - S.pkGuthabenRelativ) } })),
    },
    {
      id: 'umwandlungssatz',
      label: 'PK-Umwandlungssatz',
      variante: `${S.umwandlungssatzPunkte * 100} Prozentpunkt tiefer`,
      geschaetzt: geschaetzt('pkUmwandlungssatz'),
      h: mitPersonen((p) => ({
        ...p,
        pk: { ...p.pk, umwandlungssatz: Math.max(0, p.pk.umwandlungssatz - S.umwandlungssatzPunkte) },
      })),
    },
    {
      id: 'rendite',
      label: 'Börsenrendite',
      variante: `${S.renditePunkte * 100} Prozentpunkt tiefer`,
      geschaetzt: true,
      h: { ...h, annahmen: { ...h.annahmen, renditeNominal: h.annahmen.renditeNominal - S.renditePunkte } },
    },
    {
      id: 'ausgaben',
      label: 'Ausgaben',
      variante: `${Math.round(S.ausgabenRelativ * 100)}% höher`,
      geschaetzt: false,
      h: {
        ...h,
        ausgaben: { ...h.ausgaben, lebenshaltung: h.ausgaben.lebenshaltung * (1 + S.ausgabenRelativ) },
      },
    },
  ];
  const zeilen = varianten.map((v) => {
    const m = messe(v.h);
    const deltaAlterMonate =
      m.alter !== null && basis.alter !== null
        ? m.alter - basis.alter
        : m.alter === null && basis.alter === null
          ? 0
          : null;
    return {
      id: v.id,
      label: v.label,
      variante: v.variante,
      geschaetzt: v.geschaetzt,
      deltaAlterMonate,
      deltaVermoegen: m.vermoegen - basis.vermoegen,
    };
  });
  // Rangfolge: Wirkung auf das früheste Alter (unbestimmbar = gross), dann auf das Vermögen
  zeilen.sort((a, b) => {
    const da = a.deltaAlterMonate === null ? 1e6 : Math.abs(a.deltaAlterMonate);
    const db = b.deltaAlterMonate === null ? 1e6 : Math.abs(b.deltaAlterMonate);
    return db - da || Math.abs(b.deltaVermoegen) - Math.abs(a.deltaVermoegen);
  });
  return { vergleichsAlter, zeilen };
}
