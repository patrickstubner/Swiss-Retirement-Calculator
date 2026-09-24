/**
 * Jährliche Vermögensprojektion in realen CHF (heutige Kaufkraft) von heute bis zum
 * Planungsalter der jüngeren Person. Ereignisse (Lohnende, Rentenbeginn, Freigabe von
 * Vorsorgeguthaben, Einmalereignisse) werden monatsgenau erfasst, Steuern und Rendite
 * jährlich.
 *
 * Vermögens-Töpfe pro Person (nie vermischt):
 * - verfügbar: Bargeld, Wertschriften, Sonstiges, Wohneigentum (netto)
 * - gebunden: Pensionskasse, Freizügigkeit, Säule 3a (gesperrt bis zum zulässigen Bezugsalter)
 * Jeder Topf hat eine eigene Rendite. Ausgaben werden nur aus verfügbaren Töpfen bezahlt
 * (Bargeld → Wertschriften → Sonstiges → Wohneigentum). Reicht das nicht, entsteht ein
 * Fehlbetrag; ist dann noch gebundenes Vorsorgevermögen vorhanden, ist das eine
 * Liquiditätslücke.
 *
 * Konventionen:
 * - Steuertarife und Grenzbeträge gelten als an die Teuerung angepasst (real konstant).
 * - AHV-Renten folgen der Teuerung + `ahvAnpassungReal`.
 * - PK-Renten und der AHV-Rentenzuschlag sind nominal fix (verlieren real an Wert).
 * - Rendite auf den Anfangsbeständen; Kapitalbezüge und Jahressaldo am Jahresende.
 * - TODO(wegzug): Barauszahlung von PK/FZ bei endgültiger Ausreise (Art. 5 FZG, Art. 25f FZG).
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
import { realerBetrag } from './indexierung';
import { waehleKantonsModell } from './kantone';
import { neBefreitDurchEhegatte, neBeitrag } from './neBeitrag';
import { deterministisch, type RenditeModell } from './renditen';
import { dbgEinkommen, dbgKapital } from './steuern';
import type { Haushalt, JahresZeile, Monat, Person, PersonInfo, SimulationsErgebnis, Toepfe } from './typen';

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
  fzStartIdx: number;
  s3aMax: number;
  auslandStartIdx: number[];
  info: PersonInfo;
  // laufender Zustand
  t: Toepfe;
  pkBezogen: boolean;
  pkRenteNominal: number;
  s3aBezogen: boolean;
  fzBezogen: boolean;
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

/** Töpfe einer Person heute. */
export function startToepfe(p: Person): Toepfe {
  return {
    bargeld: Math.max(0, p.bargeld),
    wertschriften: Math.max(0, p.wertschriften),
    sonstiges: Math.max(0, p.sonstiges.wert),
    wohneigentum: wohneigentumNetto(p),
    pk: Math.max(0, p.pk.guthaben),
    freizuegigkeit: Math.max(0, p.freizuegigkeit.guthaben),
    saeule3a: Math.max(0, p.saeule3a.guthaben),
  };
}

export const verfuegbar = (t: Toepfe): number => t.bargeld + t.wertschriften + t.sonstiges + t.wohneigentum;
export const gebunden = (t: Toepfe): number => t.pk + t.freizuegigkeit + t.saeule3a;

/**
 * Verfügbares Vermögen zu Beginn (alle Personen): Bargeld, Wertschriften, Sonstiges und
 * Nettowert Wohneigentum. Vereinfachung (Vorgabe): Wohneigentum wird wie an der Börse
 * angelegtes Kapital behandelt; Eigenmietwert, Unterhalt und Verkaufskosten fehlen.
 */
export function startvermoegen(h: Haushalt): number {
  return h.personen.reduce((s, p) => s + verfuegbar(startToepfe(p)), 0);
}

const summeToepfe = (xs: Toepfe[]): Toepfe =>
  xs.reduce(
    (s, x) => ({
      bargeld: s.bargeld + x.bargeld,
      wertschriften: s.wertschriften + x.wertschriften,
      sonstiges: s.sonstiges + x.sonstiges,
      wohneigentum: s.wohneigentum + x.wohneigentum,
      pk: s.pk + x.pk,
      freizuegigkeit: s.freizuegigkeit + x.freizuegigkeit,
      saeule3a: s.saeule3a + x.saeule3a,
    }),
    { bargeld: 0, wertschriften: 0, sonstiges: 0, wohneigentum: 0, pk: 0, freizuegigkeit: 0, saeule3a: 0 },
  );

export const geburtIndex = (p: Person): number => p.geburtsjahr * 12 + (p.geburtsmonat - 1);

/** Zulässiges Bezugsalter (Monate) für 3a bzw. Freizügigkeit: RA−5 … RA (+5 bei Erwerb). */
export function vorsorgeBezugMonate(
  stoppMonate: number,
  raMonate: number,
  fixAlter: number | null,
  jahreVorRA: number,
  jahreNachRA: number,
): number {
  const frueh = raMonate - jahreVorRA * 12;
  const spaet = raMonate + (stoppMonate > raMonate ? Math.min(stoppMonate - raMonate, jahreNachRA * 12) : 0);
  const wunsch = fixAlter !== null ? Math.round(fixAlter * 12) : stoppMonate;
  return Math.min(Math.max(wunsch, frueh), spaet);
}

/** PK-Bezugsalter (Monate): bei Erwerbsaufgabe, frühestens gemäss Reglement (58–70), spätestens 70. */
export function pkBezugMonate(p: Person, stoppMonate: number, regeln: Regeln): number {
  const b = regeln.bvg.bezugsalter;
  const frueh = Math.min(Math.max(p.pk.fruehestesAlter, b.reglementFruehestens), b.aufschubBis) * 12;
  const wunsch = p.pk.bezugsAlter !== null ? Math.round(p.pk.bezugsAlter * 12) : stoppMonate;
  return Math.min(Math.max(wunsch, frueh), b.aufschubBis * 12);
}

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
  const mdje = p.ahv.modus === 'skala44' || p.ahv.mdje > 0 ? p.ahv.mdje : ahvMdjeAusRente(p.ahv.renteMonat, regeln.ahv);
  const ahvBasisMonat =
    p.ahv.modus === 'eingabe'
      ? Math.max(0, p.ahv.renteMonat)
      : ahvTeilrente(ahvRenteSkala44(mdje, regeln.ahv), p.ahv.beitragsjahre, regeln.ahv);
  const ahvFaktor = ahvBezugFaktor(verschiebung, p.geburtsjahr, p.geschlecht, mdje, regeln.ahv);
  const zuschlagNominal =
    ahvBasisMonat > 0
      ? ahvRentenzuschlag(p.geburtsjahr, p.geschlecht, mdje, verschiebung, p.ahv.beitragsjahre, regeln.ahv)
      : 0;
  const ahvStartIdx = geburtIdx + raMonate + 1 + verschiebung;

  const pkStartMonate = pkBezugMonate(p, stoppMonate, regeln);
  if (stoppMonate < pkStartMonate && p.pk.guthaben > 0)
    hinweise.push(
      'Erwerbsaufgabe vor dem frühesten PK-Bezugsalter: Das Guthaben bleibt bis dahin gesperrt und wird weiter verzinst.',
    );

  const b3a = regeln.saeule3a.bezug;
  const s3aStartMonate = vorsorgeBezugMonate(
    stoppMonate,
    raMonate,
    p.saeule3a.bezugsAlter,
    b3a.fruehestensJahreVorRA,
    b3a.aufschubJahreNachRA,
  );
  const bfz = regeln.bvg.freizuegigkeitBezug;
  const fzStartMonate = vorsorgeBezugMonate(
    stoppMonate,
    raMonate,
    p.freizuegigkeit.bezugsAlter,
    bfz.fruehestensJahreVorRA,
    bfz.aufschubJahreNachRA,
  );
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
    fzStartIdx: geburtIdx + fzStartMonate,
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
      freizuegigkeitStart: ausMonatIndex(geburtIdx + fzStartMonate),
      freizuegigkeitKapital: 0,
      hinweise,
    },
    t: startToepfe(p),
    pkBezogen: false,
    pkRenteNominal: 0,
    s3aBezogen: false,
    fzBezogen: false,
  };
}

const ENTNAHME_REIHENFOLGE = ['bargeld', 'wertschriften', 'sonstiges', 'wohneigentum'] as const;

/**
 * Entnimmt `betrag` aus den verfügbaren Töpfen aller Personen (Bargeld → Wertschriften →
 * Sonstiges → Wohneigentum). Gibt den nicht gedeckten Rest und ob Wohneigentum angetastet
 * wurde zurück.
 */
export function entnehme(toepfe: Toepfe[], betrag: number): { rest: number; wohneigentum: boolean } {
  let rest = betrag;
  let wohneigentum = false;
  for (const topf of ENTNAHME_REIHENFOLGE) {
    for (const t of toepfe) {
      if (rest <= 0) return { rest: 0, wohneigentum };
      const x = Math.min(Math.max(0, t[topf]), rest);
      if (x > 0) {
        t[topf] -= x;
        rest -= x;
        if (topf === 'wohneigentum') wohneigentum = true;
      }
    }
  }
  return { rest: Math.max(0, rest), wohneigentum };
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
  // Bezugsdaten in der Vergangenheit: Bezug frühestens im Startmonat
  for (const pl of plaene) {
    const ab = (idx: number) => ausMonatIndex(Math.max(idx, startIdx));
    pl.info.pkStart = ab(pl.pkStartIdx);
    pl.info.saeule3aStart = ab(pl.s3aStartIdx);
    pl.info.freizuegigkeitStart = ab(pl.fzStartIdx);
  }
  const beitr = regeln.beitraege;
  const ne = beitr.nichterwerbstaetige;
  const posten = h.posten ?? [];
  const ereignisse = h.ereignisse ?? [];
  const ereignisIdx = ereignisse.map((e) => {
    const p = h.personen[e.person] ?? ref;
    return geburtIndex(p) + Math.round(e.alter * 12);
  });

  let fehlbetrag = 0;
  let deflator = 1;
  let ruinJahr: number | null = null;
  let wohneigentumAngetastetJahr: number | null = null;
  const liquiditaetsluecken: number[] = [];
  const zeilen: JahresZeile[] = [];
  const n = plaene.length;
  const neu = () => new Array<number>(n).fill(0);
  const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

  for (let jahr = opt.start.jahr; jahr <= endJahr; jahr++) {
    const t = jahr - opt.start.jahr;
    const inflation = modell.inflation(t);
    const rNom = modell.renditeNominal(t);
    const real = (nominal: number) => (1 + nominal) / (1 + inflation) - 1;
    const rWert = real(rNom - a.kosten);
    const rBar = real(a.renditeBargeld);
    const ersterMonat = jahr === opt.start.jahr ? opt.start.monat : 1;
    const nMonate = 13 - ersterMonat;
    const wachstum = (r: number) => (1 + r) ** (nMonate / 12);

    // Anfangsbestände (für Vermögenssteuer, NE-Beiträge, Vermögensertrag)
    const verfuegbarStart = sum(plaene.map((pl) => verfuegbar(pl.t))) - fehlbetrag;
    const finanzStart = sum(plaene.map((pl) => pl.t.bargeld + pl.t.wertschriften + pl.t.sonstiges));

    const lohn = neu();
    const ahv = neu();
    const zuschlag = neu();
    const pkRente = neu();
    const ausland = neu();
    const auslandSteuerbar = neu();
    const neMonate = neu();
    const pkBeitragAN = neu();
    const s3aBeitrag = neu();
    const kapital = neu();
    let weitereEinnahmen = 0;
    let weitereEinnahmenSteuerbar = 0;
    let weitereAusgaben = 0;
    let einmalig = 0;
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

        // Pensionskasse: gesperrt bis zum Bezugsalter; dann Rente/Kapital/Mix
        if (!pl.pkBezogen && idx >= pl.pkStartIdx) {
          const l = pkLeistung(pl.t.pk, p.pk.umwandlungssatz, p.pk.kapitalanteil);
          kapital[i] = (kapital[i] ?? 0) + l.kapital;
          pl.pkRenteNominal = l.renteJahr * deflator;
          pl.info.pkRenteJahr = l.renteJahr;
          pl.info.pkKapital = l.kapital;
          pl.t.pk = 0;
          pl.pkBezogen = true;
        }
        if (!pl.pkBezogen) {
          pl.t.pk *= (1 + real(p.pk.zins)) ** (1 / 12);
          if (erwerb) {
            const beitrag =
              p.pk.beitragModus === 'eingabe'
                ? (Math.max(0, p.pk.sparbeitragJahr) * (1 + p.lohnwachstumReal) ** t) / 12
                : bvgAltersgutschrift(lohnJahr, jahr - p.geburtsjahr, Math.floor(pl.raMonate / 12), regeln.bvg) / 12;
            pl.t.pk += beitrag;
            pkBeitragAN[i] = (pkBeitragAN[i] ?? 0) + beitrag * p.pk.anteilArbeitnehmer;
          }
        }
        if (pl.pkBezogen) pkRente[i] = (pkRente[i] ?? 0) + pl.pkRenteNominal / deflator / 12;

        // Freizügigkeit: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), Bezug als Kapital
        if (!pl.fzBezogen && idx >= pl.fzStartIdx) {
          kapital[i] = (kapital[i] ?? 0) + pl.t.freizuegigkeit;
          pl.info.freizuegigkeitKapital = pl.t.freizuegigkeit;
          pl.t.freizuegigkeit = 0;
          pl.fzBezogen = true;
        }
        if (!pl.fzBezogen) pl.t.freizuegigkeit *= (1 + real(p.freizuegigkeit.zins)) ** (1 / 12);

        // Säule 3a: gesperrt bis RA−5 (bzw. Erwerbsaufgabe), spätestens RA (+5 bei Erwerb)
        if (!pl.s3aBezogen && idx >= pl.s3aStartIdx) {
          kapital[i] = (kapital[i] ?? 0) + pl.t.saeule3a;
          pl.info.saeule3aKapital = pl.t.saeule3a;
          pl.t.saeule3a = 0;
          pl.s3aBezogen = true;
        }
        if (!pl.s3aBezogen) {
          pl.t.saeule3a *= (1 + real(p.saeule3a.rendite)) ** (1 / 12);
          if (erwerb) {
            const c = Math.min(Math.max(0, p.saeule3a.beitragJahr), pl.s3aMax) / 12;
            pl.t.saeule3a += c;
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

      // Weitere wiederkehrende Posten
      for (const po of posten) {
        const p = h.personen[po.person] ?? ref;
        const alterM = idx - geburtIndex(p);
        const endeM = po.endAlter === null ? Number.POSITIVE_INFINITY : Math.round(po.endAlter * 12);
        if (alterM < Math.round(po.startAlter * 12) || alterM >= endeM) continue;
        const v = realerBetrag(Math.max(0, po.betragJahr), po.indexierung, t, deflator) / 12;
        if (po.art === 'einnahme') {
          weitereEinnahmen += v;
          if (po.steuerbar) weitereEinnahmenSteuerbar += v;
        } else weitereAusgaben += v;
      }
      // Einmalige Ereignisse
      ereignisse.forEach((e, k) => {
        if (ereignisIdx[k] === idx) einmalig += e.betrag;
      });
    }

    const sozial = lohn.map(
      (l) => l * beitr.ahvIvEoSatzArbeitnehmer + Math.min(l, beitr.alvHoechstlohn) * beitr.alvSatzArbeitnehmer,
    );
    const ahv13Betrag = ahv.map((x) => ahv13(x, jahr, regeln.ahv));
    const ertrag = Math.max(0, finanzStart - fehlbetrag) * a.steuerbarerErtrag;

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
        (ertrag + weitereEinnahmenSteuerbar) / n,
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
    // Vermögenssteuer auf dem verfügbaren Vermögen inkl. Nettowert Wohneigentum (Verkehrswert).
    // TODO(kantone): kantonaler Steuerwert der Liegenschaft (meist unter Verkehrswert) und
    // Schuldenabzug gemäss Kantonsmodell, sobald tarifbasierte Kantonsdaten vorliegen.
    const steuernVermoegen =
      (kanton.vermoegenssteuer(Math.max(0, verfuegbarStart), verheiratet ? 'verheiratet' : 'alleinstehend') * nMonate) /
      12;

    // NE-Beiträge (Vermögen ohne 2. Säule/3a)
    let neBeitraege = 0;
    plaene.forEach((_pl, i) => {
      const monate = neMonate[i] ?? 0;
      if (monate === 0) return;
      if (verheiratet) {
        const andere = plaene.findIndex((_, j) => j !== i);
        if (andere >= 0 && neBefreitDurchEhegatte(lohn[andere] ?? 0, beitr.ahvIvEoSatzTotal, ne)) return;
      }
      const renteneinkommen = verheiratet ? sum(pkRente) + sum(ausland) : (pkRente[i] ?? 0) + (ausland[i] ?? 0);
      const rentenJahr = (renteneinkommen * 12) / nMonate;
      const vermoegenNe = verheiratet
        ? verfuegbarStart
        : verfuegbar(plaene[i]?.t ?? startToepfe(h.personen[i] as Person)) - fehlbetrag;
      neBeitraege += (neBeitrag(vermoegenNe, rentenJahr, verheiratet, a.neVerwaltungskosten, ne) * monate) / 12;
    });

    // Ausgaben nach Alter der Referenzperson
    const refAlter = jahr - ref.geburtsjahr;
    const faktor = refAlter >= 85 ? h.ausgaben.faktorAb85 : refAlter >= 75 ? h.ausgaben.faktorAb75 : 1;
    const lebenshaltung = (Math.max(0, h.ausgaben.lebenshaltung) * faktor * nMonate) / 12;
    const ausgaben = lebenshaltung + weitereAusgaben;

    const lohnTotal = sum(lohn);
    const ahvTotal = sum(ahv) + sum(ahv13Betrag) + sum(zuschlag);
    const sozialTotal = sum(sozial);
    const vorsorgeBeitraege = sum(pkBeitragAN) + sum(s3aBeitrag);
    const einnahmen =
      lohnTotal - sozialTotal - vorsorgeBeitraege + ahvTotal + sum(pkRente) + sum(ausland) + weitereEinnahmen;
    const abfluesse = steuernEinkommen + steuernKapital + steuernVermoegen + neBeitraege + ausgaben;
    const saldo = einnahmen - abfluesse + einmalig;

    // Rendite auf den Anfangsbeständen der verfügbaren Töpfe
    for (const pl of plaene) {
      pl.t.bargeld *= wachstum(rBar);
      pl.t.wertschriften *= wachstum(rWert);
      pl.t.wohneigentum *= pl.t.wohneigentum > 0 ? wachstum(rWert) : 1;
      pl.t.sonstiges *= wachstum(real(pl.p.sonstiges.rendite));
    }
    // Kapitalbezüge fliessen in die Wertschriften der jeweiligen Person
    plaene.forEach((pl, i) => {
      pl.t.wertschriften += kapital[i] ?? 0;
    });

    // Saldo: Überschuss tilgt zuerst einen Fehlbetrag und wird dann angelegt; Defizit aus verfügbaren Töpfen
    let angetastet = false;
    const toepfe = plaene.map((pl) => pl.t);
    if (saldo >= 0) {
      const tilgung = Math.min(fehlbetrag, saldo);
      fehlbetrag -= tilgung;
      const rest = saldo - tilgung;
      for (const pl of plaene) pl.t.wertschriften += rest / n;
    } else {
      const r = entnehme(toepfe, -saldo);
      angetastet = r.wohneigentum;
      fehlbetrag += r.rest;
    }
    // Fehlbetrag aus nachträglich verfügbaren Mitteln (z.B. Kapitalbezug) decken
    if (fehlbetrag > 0) {
      const r = entnehme(toepfe, fehlbetrag);
      angetastet = angetastet || r.wohneigentum;
      fehlbetrag = r.rest;
    }
    if (angetastet && wohneigentumAngetastetJahr === null) wohneigentumAngetastetJahr = jahr;

    const proPerson = plaene.map((pl) => ({ ...pl.t }));
    const summe = summeToepfe(proPerson);
    const verf = verfuegbar(summe);
    const geb = gebunden(summe);
    const luecke = fehlbetrag > 0.5 && geb > 0;
    if (fehlbetrag > 0.5 && ruinJahr === null) ruinJahr = jahr;
    if (luecke) liquiditaetsluecken.push(jahr);

    zeilen.push({
      jahr,
      alter: h.personen.map((p) => jahr - p.geburtsjahr),
      lohn: lohnTotal,
      ahv: ahvTotal,
      pkRente: sum(pkRente),
      auslandRenten: sum(ausland),
      weitereEinnahmen,
      einmalig,
      kapitalBezuege: kapitalTotal,
      sozialabgaben: sozialTotal,
      neBeitraege,
      steuernEinkommen,
      steuernKapital,
      steuernVermoegen,
      ausgaben,
      sparbeitraegeVorsorge: vorsorgeBeitraege,
      saldo,
      toepfe: summe,
      toepfeProPerson: proPerson,
      verfuegbar: verf,
      gebunden: geb,
      fehlbetrag,
      vermoegen: verf - fehlbetrag,
      total: verf + geb - fehlbetrag,
      liquiditaetsluecke: luecke,
      wohneigentumAngetastet: angetastet,
      pkGuthaben: summe.pk,
      saeule3aGuthaben: summe.saeule3a,
    });
    deflator *= 1 + inflation;
  }

  const letzte = zeilen.at(-1);
  return {
    zeilen,
    erfolg: ruinJahr === null,
    ruinJahr,
    ruinAlter: ruinJahr === null ? null : ruinJahr - ref.geburtsjahr,
    endVermoegen: letzte ? letzte.vermoegen : startvermoegen(h),
    liquiditaetsluecken,
    wohneigentumAngetastetJahr,
    personen: plaene.map((pl) => pl.info),
  };
}
