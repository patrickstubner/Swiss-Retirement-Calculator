/**
 * Hinweise zu den Eingaben, die das Ergebnis stark beeinflussen (reine Logik, ohne Rechnung):
 * - nur eine Person eines Paares zieht weg,
 * - kein Wohnkanton, obwohl Wegzug, Kapitalbezug oder Hausverkauf vorliegen,
 * - Hausverkauf ohne Anlagekosten (der ganze Preis gälte als Gewinn).
 */
import type { Haushalt, Person } from './typen';

const name = (p: Person, i: number) => p.name.trim() || `Person ${i + 1}`;

/** Person hat Kapitalleistungen aus PK, Freizügigkeit oder 3a (Guthaben erfasst) */
export const hatKapitalbezug = (p: Person): boolean =>
  p.pk.guthaben > 0 || p.freizuegigkeit.guthaben > 0 || p.saeule3a.guthaben > 0;

export const hatVerkauf = (p: Person): boolean => p.wohneigentum.vorhanden && p.wohneigentum.verkauf.aktiv;

/** Paar, in dem mindestens eine, aber nicht alle Personen wegziehen: Text, sonst null. */
export function nurEinePersonWegzug(h: Haushalt): string | null {
  if (h.zivilstand !== 'verheiratet' || h.personen.length < 2) return null;
  const weg = h.personen.filter((p) => p.wohnsitzAusland.aktiv);
  if (weg.length === 0 || weg.length === h.personen.length) return null;
  const bleibt = h.personen.map((p, i) => ({ p, i })).filter(({ p }) => !p.wohnsitzAusland.aktiv);
  const wer = bleibt.map(({ p, i }) => name(p, i)).join(' und ');
  return `${wer} wohnt weiter in der Schweiz: Für ${bleibt.length > 1 ? 'sie' : 'die Person'} gelten weiter Schweizer Steuern und AHV-Regeln, und solange eine Person hier wohnt, rechnet der Rechner mit Schweizer Steuern auf dem ganzen Haushalt (Näherung).`;
}

/** Kein Wohnkanton, obwohl er das Ergebnis klar verändert: Text, sonst null. */
export function kantonFehltHinweis(h: Haushalt): string | null {
  if (h.steuern.kanton !== '' || h.steuern.eigeneSaetze) return null;
  const gruende: string[] = [];
  if (h.personen.some((p) => p.wohnsitzAusland.aktiv)) gruende.push('Wegzug');
  if (h.personen.some(hatKapitalbezug)) gruende.push('Kapitalbezug aus PK, Freizügigkeit oder 3a');
  if (h.personen.some(hatVerkauf)) gruende.push('Hausverkauf');
  if (gruende.length === 0) return null;
  return `Kein Wohnkanton gewählt, obwohl ${gruende.join(', ')} erfasst ist: Ohne Kanton fehlen Kantonssteuern (Einkommen, Vermögen, Grundstückgewinn) und der Kantonsteil der Quellensteuer. Das Ergebnis ist dann zu optimistisch. Bitte den Wohnkanton wählen.`;
}

/** Namen der Personen mit Hausverkauf ohne Anlagekosten. */
export function anlagekostenFehlen(h: Haushalt): string[] {
  return h.personen
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => hatVerkauf(p) && !(p.wohneigentum.verkauf.anlagekosten > 0))
    .map(({ p, i }) => name(p, i));
}

export const ANLAGEKOSTEN_WARNUNG =
  'Anlagekosten fehlen (0): Der ganze Verkaufspreis würde als Gewinn besteuert, die Grundstückgewinnsteuer wäre viel zu hoch. Bitte den Kaufpreis inkl. wertvermehrender Investitionen eintragen.';

/** Alle Hinweise für die Ergebnisseite. */
export function eingabeHinweise(h: Haushalt): string[] {
  const out: string[] = [];
  const k = kantonFehltHinweis(h);
  if (k) out.push(k);
  const w = nurEinePersonWegzug(h);
  if (w) out.push(w);
  const a = anlagekostenFehlen(h);
  if (a.length > 0)
    out.push(`${a.length > 1 ? `${a.join(' und ')}: ` : ''}Hausverkauf ohne Anlagekosten: ${ANLAGEKOSTEN_WARNUNG}`);
  return out;
}
