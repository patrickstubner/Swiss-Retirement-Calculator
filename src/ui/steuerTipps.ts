/**
 * Steuer-Tipps zur Staffelung der Kapitalbezüge: nur Hinweise, die für den Fall der Eingaben realistisch sind.
 * Reine Logik ohne React (testbar). Quellen: docs/quellen.md Abschnitt 18.
 *
 * Regeln:
 * - Kein Staffel-Tipp für Personen mit erfasstem Wegzug: Bei Wohnsitz im Ausland gilt die Quellensteuer (weitgehend
 *   flach, Bezug bei Wegzug in einem Schritt); ein Bezug über den Wegzug hinweg ist nicht sinnvoll.
 * - EU/EFTA: das gesperrte Obligatorium wird nirgends als Kapital vorgeschlagen (Art. 25f FZG).
 * - Der Staffel-Tipp nennt eine Ersparnis nur, wenn sie mindestens `MIN_ERSPARNIS` beträgt.
 */
import { bezugsTermine } from '../core/simulation';
import type { StaffelVariante } from '../core/staffelung';
import type { Haushalt, Monat } from '../core/typen';
import type { Regeln } from '../rules';

/** Mindestersparnis (heutige CHF), ab der ein Staffel-Tipp gezeigt wird */
export const MIN_ERSPARNIS = 500;
/** Kantone, in denen die Staatssteuer der Ehegatten getrennt veranlagt wird (StB BL 36 Nr. 1 Ziff. 1.2) */
const KANTONE_GETRENNT = ['BL'];

export type TippArt = 'staffeln' | 'ehegatten' | 'wegzug' | 'einkauf' | 'aktiv';

export interface SteuerTipp {
  id: string;
  art: TippArt;
  titel: string;
  text: string;
  /** Ersparnis in heutigen CHF (nur Staffel-Tipp) */
  ersparnis?: number;
  /** Anzahl Bezugsjahre, mit der die Ersparnis erreicht wird */
  jahre?: number;
  /** Veränderung des Endvermögens (heutige CHF) gegenüber einem Bezug; negativ = im Modell weniger Endvermögen */
  endDifferenz?: number;
}

export const STAFFEL_QUELLEN: readonly { text: string; url: string; stand: string }[] = [
  {
    text: 'Art. 38 DBG (Kapitalleistungen aus Vorsorge: volle Jahressteuer, ein Fünftel des Tarifs)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de',
    stand: '1.1.2026',
  },
  {
    text: 'Kanton Zürich, Weisung ZStB 22.1 (im gleichen Steuerjahr fällige Kapitalleistungen werden zusammengezählt)',
    url: 'https://www.zh.ch/de/steuern-finanzen/steuern/treuhaender/steuerbuch/steuerbuch-definition/zstb-22-1.html',
    stand: 'gültig ab Steuerperiode 2022, abgerufen 29.9.2026',
  },
  {
    text: 'Kanton Bern, TaxInfo «Berufliche Vorsorge» (Zusammenrechnung, Teilpensionierung, Sperrfrist nach Einkauf)',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/8e35a347-48f2-44b2-99e6-1863bccc18b7',
    stand: 'Fassung 26.2.2026, abgerufen 29.9.2026',
  },
  {
    text: 'Kanton Basel-Landschaft, Steuerbuch 36 Nr. 1 (Zusammenrechnung, Ehegatten bei der Staatssteuer getrennt, Teilpensionierung)',
    url: 'https://kanton.baselland.ch/finanz-und-kirchendirektion/steuerverwaltung-steuerbuch/band-1/berechung/downloads-1/band1_036_01.pdf/@@download/file/band1_036_01.pdf',
    stand: '22.4.2025, abgerufen 29.9.2026',
  },
  {
    text: 'Kanton St. Gallen, StB 52 Nr. 3 (3a: Konten innert fünf Jahren vor dem AHV-Alter gestaffelt auflösen; nur ganzes Guthaben übertragbar)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/052_3.pdf',
    stand: '1.7.2021, abgerufen 29.9.2026',
  },
  {
    text: 'Art. 13a und 13b BVG (Teilbezug der Altersleistung: höchstens drei Kapitalschritte, erster Schritt mindestens 20 %)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1983/797_797_797/de',
    stand: '1.1.2024',
  },
  {
    text: 'Art. 12 und 16 FZV (höchstens zwei Freizügigkeitseinrichtungen; Bezug frühestens fünf Jahre vor dem Referenzalter)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1994/2399_2399_2399/de',
    stand: '1.1.2024',
  },
  {
    text: 'Art. 79b Abs. 3 BVG (Sperrfrist von drei Jahren nach einem Einkauf)',
    url: 'https://www.fedlex.admin.ch/eli/cc/1983/797_797_797/de',
    stand: '1.1.2024',
  },
];

const chf = (x: number) => `CHF ${Math.round(x).toLocaleString('de-CH')}`;

/** Beste Variante: kleinste Anzahl Jahre, die mindestens 90 % der grössten Ersparnis erreicht. */
export function besteVariante(v: readonly StaffelVariante[]): StaffelVariante | null {
  const maxErsp = Math.max(0, ...v.map((x) => x.ersparnis));
  if (maxErsp <= 0) return null;
  return [...v].sort((a, b) => a.jahre - b.jahre).find((x) => x.ersparnis >= 0.9 * maxErsp) ?? null;
}

/**
 * @param h Haushalt (effektiv, mit oder ohne aktive Staffelung)
 * @param varianten Ergebnis von `staffelVarianten` (Basis = 1 Jahr)
 */
export function steuerTipps(
  h: Haushalt,
  regeln: Regeln,
  heute: Monat,
  varianten: readonly StaffelVariante[],
  namen: readonly string[],
): SteuerTipp[] {
  const tipps: SteuerTipp[] = [];
  const ohne: Haushalt = { ...h, staffelung: undefined };
  const termine = bezugsTermine(ohne, regeln, heute);
  const name = (i: number) => namen[i] ?? `Person ${i + 1}`;
  const quellen = (t: (typeof termine)[number]) =>
    [t.pk ? 'pk' : null, t.fz ? 'fz' : null, t.s3a ? 's3a' : null].filter((x): x is 'pk' | 'fz' | 's3a' => x !== null);

  // Wegzug: nicht staffeln
  termine.forEach((t, i) => {
    if (t.wegzug && quellen(t).length > 0)
      tipps.push({
        id: `wegzug-${i}`,
        art: 'wegzug',
        titel: `${name(i)}: nicht staffeln, wenn Sie vor dem Bezug wegziehen`,
        text: 'Bei einem Bezug nach dem Wegzug erhebt die Vorsorgeeinrichtung Quellensteuer (Bund und Sitzkanton), die kaum von der Höhe abhängt. Staffeln über den Wegzug hinweg bringt deshalb nichts; der Bezug erfolgt in einem Schritt. Vergleichen Sie stattdessen Bezug in der Schweiz und Bezug nach dem Wegzug in der Karte «Wegzug-Vergleich».',
      });
  });

  const chPersonen = termine.map((t, i) => ({ t, i })).filter(({ t }) => !t.wegzug && quellen(t).length > 0);

  // Bezüge im selben Jahr (pro Person, ohne Staffelung)
  const gleichesJahr = chPersonen.some(({ t }) => {
    const jahre = quellen(t).map((q) => (t[q] as { jahr: number }).jahr);
    return new Set(jahre).size < jahre.length;
  });
  const aktiv = h.staffelung?.aktiv === true && (h.staffelung.jahre ?? 1) > 1;
  const best = besteVariante(varianten);
  if (chPersonen.length > 0 && best && best.ersparnis >= MIN_ERSPARNIS && !aktiv) {
    const teile: string[] = [];
    if (chPersonen.some(({ t }) => t.s3a))
      teile.push(
        'Dafür brauchen Sie mehrere 3a-Konten (oder -Depots) – jedes wird ganz aufgelöst; ein nachträgliches Aufteilen ist nicht zulässig.',
      );
    if (chPersonen.some(({ t }) => t.fz))
      teile.push('Bei der Freizügigkeit sind höchstens zwei Einrichtungen möglich.');
    const basis = varianten.find((x) => x.jahre === 1);
    const endDifferenz = basis ? best.endVermoegen - basis.endVermoegen : 0;
    const renditeHinweis =
      endDifferenz < -MIN_ERSPARNIS
        ? ` Achtung: Im Modell sinkt das Endvermögen trotzdem um ca. ${chf(-endDifferenz)} (heutige CHF), weil das später bezogene Guthaben bis dahin nur mit der 3a-Rendite bzw. dem Freizügigkeitszins verzinst wird und nicht mit der Rendite Ihrer Wertschriften. Die Steuerersparnis allein entscheidet nicht; prüfen Sie beide Zahlen in der Tabelle.`
        : '';
    tipps.push({
      id: 'staffeln',
      art: 'staffeln',
      titel: `Kapitalbezüge auf ${best.jahre} Jahre verteilen`,
      text: `${gleichesJahr ? 'Ihre Bezüge fallen im selben Jahr an und werden zusammengerechnet. ' : ''}Verteilt auf ${best.jahre} Jahre sinkt die Steuer auf Kapitalleistungen im Modell um ca. ${chf(best.ersparnis)}, weil jede Kapitalleistung einzeln mit einem tieferen Satz besteuert wird. ${teile.join(' ')} Einzelne Kantone können die Staffelung im Einzelfall als Steuerumgehung würdigen; fragen Sie Ihr Steueramt.${renditeHinweis}`,
      ersparnis: best.ersparnis,
      jahre: best.jahre,
      endDifferenz,
    });
  }
  if (aktiv) {
    const aktuell = varianten.find((x) => x.jahre === h.staffelung?.jahre) ?? null;
    if (aktuell && aktuell.ersparnis > 0)
      tipps.push({
        id: 'aktiv',
        art: 'aktiv',
        titel: 'Staffelung ist eingeschaltet',
        text: `Die Bezüge sind im Plan auf ${aktuell.jahre} Jahre verteilt; das spart im Modell ca. ${chf(aktuell.ersparnis)} Steuern gegenüber einem einzigen Bezug (das Endvermögen ändert sich dabei um ${chf(aktuell.endVermoegen - (varianten.find((x) => x.jahre === 1)?.endVermoegen ?? aktuell.endVermoegen))}, weil später bezogenes Guthaben bis dahin nur zur 3a-Rendite bzw. zum Freizügigkeitszins wächst). Voraussetzung: entsprechend viele getrennte Konten und ein Bezug innerhalb der zulässigen Fenster.`,
        ersparnis: aktuell.ersparnis,
        jahre: aktuell.jahre,
      });
  }

  // Ehepaar: Bezüge im selben Jahr werden zusammengerechnet
  if (h.zivilstand === 'verheiratet' && chPersonen.length >= 2 && !KANTONE_GETRENNT.includes(h.steuern.kanton)) {
    const jahreJe = chPersonen.map(({ t }) => new Set(quellen(t).map((q) => (t[q] as { jahr: number }).jahr)));
    const a = jahreJe[0];
    const ueberlapp = a ? [...a].some((j) => jahreJe.slice(1).some((s) => s.has(j))) : false;
    if (ueberlapp)
      tipps.push({
        id: 'ehegatten',
        art: 'ehegatten',
        titel: 'Bezüge der beiden Ehegatten in verschiedene Jahre legen',
        text: 'Bei Ehepaaren werden die im selben Jahr fälligen Kapitalleistungen beider Personen zusammengerechnet (Bund und die meisten Kantone). Legen Sie die Bezugsalter für 3a und Freizügigkeit so, dass die Bezüge der beiden nicht im selben Jahr anfallen (Felder «Bezugsalter» bei 3a und Freizügigkeit). Die Staffelung oben verteilt jede Person einzeln, verschiebt sie aber nicht gegeneinander.',
      });
  }

  // Einkauf: Sperrfrist
  const start = heute.jahr;
  const naheBezug = chPersonen.some(({ t }) =>
    [t.pk, t.fz].some((x) => x !== null && (x as { jahr: number }).jahr - start <= 3),
  );
  if (naheBezug)
    tipps.push({
      id: 'einkauf',
      art: 'einkauf',
      titel: 'Vor einem Kapitalbezug in den nächsten drei Jahren nicht einkaufen',
      text: 'Nach einem Einkauf in die Pensionskasse gilt eine Sperrfrist von drei Jahren: Ein Kapitalbezug (auch Freizügigkeit) innert dieser Frist macht den Einkaufsabzug rückgängig (Nachsteuer) und wird besteuert wie ein missbräuchlicher Bezug. Einkäufe sind im Rechner nicht modelliert.',
    });

  return tipps;
}
