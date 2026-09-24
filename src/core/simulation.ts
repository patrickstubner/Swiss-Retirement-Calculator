/**
 * Jährliche Cashflow-Simulation in realen CHF (heutige Kaufkraft) von heute bis zum
 * Planungsalter der jüngeren Person. Ereignisse (Lohnende, Rentenbeginn, Kapitalbezug)
 * werden monatsgenau erfasst, Steuern und Rendite jährlich.
 *
 * Konventionen:
 * - Steuertarife und Grenzbeträge gelten als an die Teuerung angepasst (real konstant).
 * - AHV-Renten folgen der Teuerung + `ahvAnpassungReal`.
 * - PK-Renten und der AHV-Rentenzuschlag sind nominal fix (verlieren real an Wert).
 * - Rendite auf dem freien Vermögen: Anfangsbestand ganzjährig, Jahressaldo halbjährig.
 */
import type { Regeln } from '../rules';
import {
  ahv13,
  ahvBezugFaktor,
  ahvMdjeAusRente,
  ahvPlafonierung,
  ahvReferenzalter,
  ahvRentenzuschlag,
  ahvRenteSkala44,
  ahvTeilrente,
  ausMonatIndex,
  inMonaten,
  monatIndex,
  pruefeAhvVerschiebung,
} from './ahv';
import { auslandRenteRealJahr } from './auslandRenten';
import { bvgAltersgutschrift, pkLeistung } from './bvg';
import { waehleKantonsModell } from './kantone';
import { neBefreitDurchEhegatte, neBeitrag } from './neBeitrag';
import { deterministisch, type RenditeModell, realeNettorendite } from './renditen';
import { dbgEinkommen, dbgKapital } from './steuern';
import type { Haushalt, JahresZeile, Monat, Person, PersonInfo, SimulationsErgebnis } from './typen';

export interface SimOptionen {
  /** Erster simulierter Monat (z.B. aktueller Monat) */
  start: Monat;
  renditeModell?: RenditeModell;
  /** Überschreibt das Stopp-Alter pro Person (in Monaten), z.B. für den Solver */
  stoppAlterMonate?: readonly (number | undefined)[];
}

interface PersonPlan {
  p: Person;
  geburtIdx: number;
  raMonate: number;
  stoppMonate: number;
  ahvStartIdx: number;
  ahvBasisMonat: number;
  ahvFaktor: number;
  zuschlagNominal: number;
  pkStartIdx: number;
  s3aStartIdx: number;
  s3aMax: number;
  auslandStartIdx: number[];
  info: PersonInfo;
  // laufender Zustand
  pkGuthaben: number;
  pkBezogen: boolean;
  pkRenteNominal: number;
  s3aGuthaben: number;
  s3aBezogen: boolean;
}

/** Index der jüngeren Person (Referenz für Planungsalter und Ausgabenphasen). */
export function referenzPerson(personen: readonly Person[]): number {
  let best = 0;
  personen.forEach((p, i) => {
    const b = personen[best];
    if (b && p.geburtsjahr * 12 + p.geburtsmonat > b.geburtsjahr * 12 + b.geburtsmonat) best = i;
  });
  return best;
}

/** Nettowert des Wohneigentums (Verkehrswert − Hypothek), 0 ohne Wohneigentum. */
export function wohneigentumNetto(p: Person): number {
  const w = p.wohneigentum;
  return w.vorhanden ? Math.max(0, w.verkehrswert) - Math.max(0, w.hypothek) : 0;
}

/**
 * Anlagevermögen zu Beginn: Summe aller Personen aus freiem Vermögen und Nettowert des
 * Wohneigentums. Vereinfachung (Vorgabe): Wohneigentum wird wie an der Börse angelegtes
 * Kapital behandelt (gleiche Rendite, jederzeit verfügbar); Eigenmietwert, Unterhalt und
 * Verkaufskosten werden nicht berücksichtigt.
 */
export function startvermoegen(h: Haushalt): number {
  return h.personen.reduce((s, p) => s + Math.max(0, p.vermoegen) + wohneigentumNetto(p), 0);
}

export const geburtIndex = (p: Person): number => p.geburtsjahr * 12 + (p.geburtsmonat - 1);

function planePerson(p: Person, regeln: Regeln, stoppMonate: number): PersonPlan {
  const hinweise: string[] = [];
  const geburtIdx = geburtIndex(p);
  const raMonate = inMonaten(ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv));
  let verschiebung = p.ahv.bezugVerschiebungMonate;
  const fehler = pruefeAhvVerschiebung(verschiebung, p.geburtsjahr, p.geschlecht, regeln.ahv);
  if (fehler) {
    hinweise.push(`AHV: ${fehler} Es wird mit ordentlichem Bezug gerechnet.`);
    verschiebung = 0;
  }
  const mdje = p.ahv.modus === 'skala44' ? p.ahv.mdje : ahvMdjeAusRente(p.ahv.renteMonat, regeln.ahv);
  const ahvBasisMonat =
    p.ahv.modus === 'eingabe'
      ? Math.max(0, p.ahv.renteMonat)
      : ahvTeilrente(ahvRenteSkala44(mdje, regeln.ahv), p.ahv.beitragsjahre, regeln.ahv);
  const ahvFaktor = ahvBezugFaktor(verschiebung, p.geburtsjahr, p.geschlecht, mdje, regeln.ahv);
  const zuschlagNominal = ahvRentenzuschlag(
    p.geburtsjahr,
    p.geschlecht,
    mdje,
    verschiebung,
    p.ahv.beitragsjahre,
    regeln.ahv,
  );
  const ahvStartIdx = geburtIdx + raMonate + 1 + verschiebung;

  const bvg = regeln.bvg;
  const pkFrueh = Math.max(p.pk.fruehestesAlter, bvg.bezugsalter.reglementFruehestens) * 12;
  let pkStartMonate = p.pk.bezugsAlter !== null ? Math.round(p.pk.bezugsAlter * 12) : Math.max(stoppMonate, pkFrueh);
  pkStartMonate = Math.min(Math.max(pkStartMonate, pkFrueh), bvg.bezugsalter.aufschubBis * 12);
  if (stoppMonate < pkFrueh && p.pk.guthaben > 0)
    hinweise.push(
      'Erwerbsaufgabe vor dem frühesten PK-Bezugsalter: Guthaben wird bis dahin (wie Freizügigkeit) weiter verzinst.',
    );

  const b3a = regeln.saeule3a.bezug;
  const s3aDefault = Math.min(
    Math.max(stoppMonate, raMonate - b3a.fruehestensJahreVorRA * 12),
    raMonate + b3a.aufschubJahreNachRA * 12,
  );
  const s3aStartMonate = p.saeule3a.bezugsAlter !== null ? Math.round(p.saeule3a.bezugsAlter * 12) : s3aDefault;
  const s3aMax =
    p.pk.guthaben > 0 || p.pk.sparbeitragJahr > 0 || p.pk.beitragModus === 'bvgMinimum'
      ? regeln.saeule3a.maxMitPk
      : Math.min(regeln.saeule3a.maxOhnePk, p.lohn * regeln.saeule3a.maxOhnePkSatz);
  if (p.saeule3a.beitragJahr > s3aMax) hinweise.push(`3a-Beitrag auf das Maximum von ${s3aMax} begrenzt.`);

  return {
    p,
    geburtIdx,
    raMonate,
    stoppMonate,
    ahvStartIdx,
    ahvBasisMonat,
    ahvFaktor,
    zuschlagNominal,
    pkStartIdx: geburtIdx + pkStartMonate,
    s3aStartIdx: geburtIdx + s3aStartMonate,
    s3aMax,
    auslandStartIdx: p.auslandRenten.map((r) => geburtIdx + Math.round(r.startAlter * 12)),
    info: {
      referenzalterMonate: raMonate,
      ahvStart: ausMonatIndex(ahvStartIdx),
      ahvFaktor,
      ahvRenteMonatStart: ahvBasisMonat * ahvFaktor,
      pkStart: ausMonatIndex(geburtIdx + pkStartMonate),
      pkRenteJahr: 0,
      pkKapital: 0,
      saeule3aStart: ausMonatIndex(geburtIdx + s3aStartMonate),
      saeule3aKapital: 0,
      hinweise,
    },
    pkGuthaben: Math.max(0, p.pk.guthaben),
    pkBezogen: false,
    pkRenteNominal: 0,
    s3aGuthaben: Math.max(0, p.saeule3a.guthaben),
    s3aBezogen: false,
  };
}

export function simuliere(h: Haushalt, regeln: Regeln, opt: SimOptionen): SimulationsErgebnis {
  if (h.personen.length === 0) throw new Error('Mindestens eine Person erforderlich');
  const verheiratet = h.zivilstand === 'verheiratet' && h.personen.length >= 2;
  const a = h.annahmen;
  const modell = opt.renditeModell ?? deterministisch(a.renditeNominal, a.inflation);
  const kanton = waehleKantonsModell(h.steuern, opt.start.jahr);
  const plaene = h.personen.map((p, i) =>
    planePerson(p, regeln, opt.stoppAlterMonate?.[i] ?? Math.round(p.stoppAlter * 12)),
  );
  const refIdx = referenzPerson(h.personen);
  const ref = h.personen[refIdx] as Person;
  const endJahr = ref.geburtsjahr + Math.max(0, Math.floor(h.planungsalter));
  const startIdx = monatIndex(opt.start);
  const beitr = regeln.beitraege;
  const ne = beitr.nichterwerbstaetige;

  let vermoegen = startvermoegen(h);
  let deflator = 1;
  let ruinJahr: number | null = null;
  const zeilen: JahresZeile[] = [];

  for (let jahr = opt.start.jahr; jahr <= endJahr; jahr++) {
    const t = jahr - opt.start.jahr;
    const inflation = modell.inflation(t);
    const rReal = realeNettorendite(modell.renditeNominal(t), a.kosten, inflation);
    const ersterMonat = jahr === opt.start.jahr ? opt.start.monat : 1;
    const nMonate = 13 - ersterMonat;
    const n = plaene.length;
    const lohn = new Array<number>(n).fill(0);
    const ahv = new Array<number>(n).fill(0);
    const zuschlag = new Array<number>(n).fill(0);
    const pkRente = new Array<number>(n).fill(0);
    const ausland = new Array<number>(n).fill(0);
    const auslandSteuerbar = new Array<number>(n).fill(0);
    const neMonate = new Array<number>(n).fill(0);
    const pkBeitragAN = new Array<number>(n).fill(0);
    const s3aBeitrag = new Array<number>(n).fill(0);
    const kapital = new Array<number>(n).fill(0);
    const ahvIndex = (1 + a.ahvAnpassungReal) ** t;

    for (let m = ersterMonat; m <= 12; m++) {
      const idx = jahr * 12 + (m - 1);
      if (idx < startIdx) continue;
      let basen = plaene.map((pl) => (idx >= pl.ahvStartIdx ? pl.ahvBasisMonat : 0));
      if (verheiratet && basen.length >= 2 && (basen[0] ?? 0) > 0 && (basen[1] ?? 0) > 0) {
        const [r1, r2] = ahvPlafonierung(basen[0] ?? 0, basen[1] ?? 0, regeln.ahv);
        basen = [r1, r2, ...basen.slice(2)];
      }
      plaene.forEach((pl, i) => {
        const p = pl.p;
        const alterM = idx - pl.geburtIdx;
        const erwerb = alterM >= 0 && alterM < pl.stoppMonate;
        const lohnJahr = Math.max(0, p.lohn) * (1 + p.lohnwachstumReal) ** t;
        if (erwerb) lohn[i] = (lohn[i] ?? 0) + lohnJahr / 12;

        // Pensionskasse: Bezug am Monatsanfang, sonst Verzinsung und Beiträge
        if (!pl.pkBezogen && idx >= pl.pkStartIdx) {
          const l = pkLeistung(pl.pkGuthaben, p.pk.umwandlungssatz, p.pk.kapitalanteil);
          kapital[i] = (kapital[i] ?? 0) + l.kapital;
          pl.pkRenteNominal = l.renteJahr * deflator;
          pl.info.pkRenteJahr = l.renteJahr;
          pl.info.pkKapital = l.kapital;
          pl.pkGuthaben = 0;
          pl.pkBezogen = true;
        }
        if (!pl.pkBezogen) {
          const zinsReal = (1 + p.pk.zins) / (1 + inflation) - 1;
          pl.pkGuthaben *= (1 + zinsReal) ** (1 / 12);
          if (erwerb) {
            const beitrag =
              p.pk.beitragModus === 'eingabe'
                ? (Math.max(0, p.pk.sparbeitragJahr) * (1 + p.lohnwachstumReal) ** t) / 12
                : bvgAltersgutschrift(lohnJahr, jahr - p.geburtsjahr, Math.floor(pl.raMonate / 12), regeln.bvg) / 12;
            pl.pkGuthaben += beitrag;
            pkBeitragAN[i] = (pkBeitragAN[i] ?? 0) + beitrag * p.pk.anteilArbeitnehmer;
          }
        }
        if (pl.pkBezogen) pkRente[i] = (pkRente[i] ?? 0) + pl.pkRenteNominal / deflator / 12;

        // Säule 3a: Bezug am Monatsanfang, sonst Rendite und Beiträge
        if (!pl.s3aBezogen && idx >= pl.s3aStartIdx) {
          kapital[i] = (kapital[i] ?? 0) + pl.s3aGuthaben;
          pl.info.saeule3aKapital = pl.s3aGuthaben;
          pl.s3aGuthaben = 0;
          pl.s3aBezogen = true;
        }
        if (!pl.s3aBezogen) {
          const rReal3a = (1 + p.saeule3a.rendite) / (1 + inflation) - 1;
          pl.s3aGuthaben *= (1 + rReal3a) ** (1 / 12);
          if (erwerb) {
            const c = Math.min(Math.max(0, p.saeule3a.beitragJahr), pl.s3aMax) / 12;
            pl.s3aGuthaben += c;
            s3aBeitrag[i] = (s3aBeitrag[i] ?? 0) + c;
          }
        }

        // AHV
        const basis = basen[i] ?? 0;
        if (basis > 0) {
          ahv[i] = (ahv[i] ?? 0) + basis * pl.ahvFaktor * ahvIndex;
          zuschlag[i] = (zuschlag[i] ?? 0) + pl.zuschlagNominal / deflator;
        }

        // Ausländische Renten
        p.auslandRenten.forEach((r, k) => {
          if (idx >= (pl.auslandStartIdx[k] ?? Number.POSITIVE_INFINITY)) {
            const v = auslandRenteRealJahr(r, t, deflator) / 12;
            ausland[i] = (ausland[i] ?? 0) + v;
            if (r.steuerbarInCh) auslandSteuerbar[i] = (auslandSteuerbar[i] ?? 0) + v;
          }
        });

        // NE-Beitragspflicht: nach Erwerbsaufgabe bis Ende des Monats, in dem das RA erreicht wird
        if (!erwerb && alterM >= 240 && alterM <= pl.raMonate) neMonate[i] = (neMonate[i] ?? 0) + 1;
      });
    }

    const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
    const sozial = lohn.map(
      (l) => l * beitr.ahvIvEoSatzArbeitnehmer + Math.min(l, beitr.alvHoechstlohn) * beitr.alvSatzArbeitnehmer,
    );
    const ahv13Betrag = ahv.map((x) => ahv13(x, jahr, regeln.ahv));
    const ertrag = Math.max(0, vermoegen) * a.steuerbarerErtrag;

    // Steuerbares Einkommen pro Person (vereinfachte Abzüge)
    const steuerbar = plaene.map(
      (_, i) =>
        (lohn[i] ?? 0) -
        (sozial[i] ?? 0) -
        (pkBeitragAN[i] ?? 0) -
        (s3aBeitrag[i] ?? 0) +
        ((ahv[i] ?? 0) + (ahv13Betrag[i] ?? 0) + (zuschlag[i] ?? 0) + (pkRente[i] ?? 0)) *
          regeln.steuern.rentenSteuerbarAnteil +
        (auslandSteuerbar[i] ?? 0) +
        ertrag / plaene.length,
    );
    let steuernEinkommen = 0;
    let steuernKapital = 0;
    const kapitalTotal = sum(kapital);
    if (verheiratet) {
      const s = Math.max(0, sum(steuerbar));
      steuernEinkommen = dbgEinkommen(s, 'verheiratet', regeln.steuern) + kanton.einkommenssteuer(s, 'verheiratet');
      if (kapitalTotal > 0)
        steuernKapital =
          dbgKapital(kapitalTotal, 'verheiratet', regeln.steuern) +
          kanton.kapitalleistungssteuer(kapitalTotal, 'verheiratet');
    } else {
      steuerbar.forEach((s0, i) => {
        const s = Math.max(0, s0);
        steuernEinkommen +=
          dbgEinkommen(s, 'alleinstehend', regeln.steuern) + kanton.einkommenssteuer(s, 'alleinstehend');
        const k = kapital[i] ?? 0;
        if (k > 0)
          steuernKapital +=
            dbgKapital(k, 'alleinstehend', regeln.steuern) + kanton.kapitalleistungssteuer(k, 'alleinstehend');
      });
    }
    // Vermögenssteuer auf dem Anlagevermögen inkl. Nettowert Wohneigentum (Verkehrswert).
    // TODO(kantone): kantonaler Steuerwert der Liegenschaft (meist unter Verkehrswert) und
    // Schuldenabzug gemäss Kantonsmodell, sobald tarifbasierte Kantonsdaten vorliegen.
    const steuernVermoegen =
      (kanton.vermoegenssteuer(Math.max(0, vermoegen), verheiratet ? 'verheiratet' : 'alleinstehend') * nMonate) / 12;

    // NE-Beiträge
    let neBeitraege = 0;
    plaene.forEach((_pl, i) => {
      const monate = neMonate[i] ?? 0;
      if (monate === 0) return;
      if (verheiratet) {
        const andere = plaene.findIndex((_, j) => j !== i);
        if (andere >= 0 && neBefreitDurchEhegatte(lohn[andere] ?? 0, beitr.ahvIvEoSatzTotal, ne)) return;
      }
      const renteneinkommen = verheiratet ? sum(pkRente) + sum(ausland) : (pkRente[i] ?? 0) + (ausland[i] ?? 0);
      // Renteneinkommen auf Jahresbasis hochrechnen (Teiljahr)
      const rentenJahr = (renteneinkommen * 12) / nMonate;
      neBeitraege += (neBeitrag(vermoegen, rentenJahr, verheiratet, a.neVerwaltungskosten, ne) * monate) / 12;
    });

    // Ausgaben nach Alter der Referenzperson
    const refAlter = jahr - ref.geburtsjahr;
    const faktor = refAlter >= 85 ? h.ausgaben.faktorAb85 : refAlter >= 75 ? h.ausgaben.faktorAb75 : 1;
    const ausgaben = (Math.max(0, h.ausgaben.lebenshaltung) * faktor * nMonate) / 12;

    const lohnTotal = sum(lohn);
    const ahvTotal = sum(ahv) + sum(ahv13Betrag) + sum(zuschlag);
    const sozialTotal = sum(sozial);
    const vorsorgeBeitraege = sum(pkBeitragAN) + sum(s3aBeitrag);
    const einnahmen =
      lohnTotal - sozialTotal - vorsorgeBeitraege + ahvTotal + sum(pkRente) + sum(ausland) + kapitalTotal;
    const abfluesse = steuernEinkommen + steuernKapital + steuernVermoegen + neBeitraege + ausgaben;
    const saldo = einnahmen - abfluesse;

    const wachstum = (1 + rReal) ** (nMonate / 12);
    const wachstumHalb = (1 + rReal) ** (nMonate / 24);
    vermoegen = vermoegen > 0 ? vermoegen * wachstum + saldo * wachstumHalb : vermoegen + saldo;
    if (vermoegen < 0 && ruinJahr === null) ruinJahr = jahr;

    zeilen.push({
      jahr,
      alter: h.personen.map((p) => jahr - p.geburtsjahr),
      lohn: lohnTotal,
      ahv: ahvTotal,
      pkRente: sum(pkRente),
      auslandRenten: sum(ausland),
      kapitalBezuege: kapitalTotal,
      sozialabgaben: sozialTotal,
      neBeitraege,
      steuernEinkommen,
      steuernKapital,
      steuernVermoegen,
      ausgaben,
      sparbeitraegeVorsorge: vorsorgeBeitraege,
      saldo,
      vermoegen,
      pkGuthaben: plaene.reduce((s, pl) => s + pl.pkGuthaben, 0),
      saeule3aGuthaben: plaene.reduce((s, pl) => s + pl.s3aGuthaben, 0),
    });
    deflator *= 1 + inflation;
  }

  return {
    zeilen,
    erfolg: ruinJahr === null,
    ruinJahr,
    ruinAlter: ruinJahr === null ? null : ruinJahr - ref.geburtsjahr,
    endVermoegen: vermoegen,
    personen: plaene.map((pl) => pl.info),
  };
}
