import { describe, expect, it } from 'vitest';
import { neueAhvSchaetzhilfe } from '../data/defaults';
import { ladeRegeln } from '../rules';
import { ahvRenteSkala44, mdjeTabellenwert } from './ahv';
import { type AhvSchaetzungEingabe, ahvSchaetzung, ahvVolleBeitragsdauer } from './ahvSchaetzung';

const regeln = ladeRegeln(2026);
const r = regeln.ahv;

/**
 * Offizielle Rententabelle Skala 44 (Altersrente 1/1), Merkblatt 3.01 Ausgabe Nov. 2025,
 * Anhang «AHV/IV-Renten ab 1. Januar 2025» (gültig 2026): https://www.ahv-iv.ch/p/3.01.d
 */
const TABELLE = r.rententabelleSkala44;

function eingabe(o: Partial<AhvSchaetzungEingabe> = {}): AhvSchaetzungEingabe {
  return { ...neueAhvSchaetzhilfe(), geburtsjahr: 1970, geburtsmonat: 6, geschlecht: 'm', ...o };
}

describe('Rentenformel gegen die offizielle Rententabelle Skala 44', () => {
  it('Tabelle hat 51 Stufen à 1512 von 15120 bis 90720', () => {
    expect(TABELLE).toHaveLength(51);
    TABELLE.forEach(([mdje], i) => {
      expect(mdje).toBe(15120 + i * 1512);
    });
  });

  it.each(TABELLE.map(([m, rente]) => [m ?? 0, rente ?? 0] as [number, number]))(
    'mdJE %i → %i CHF/Monat',
    (mdje, rente) => {
      expect(ahvRenteSkala44(mdje, r)).toBe(rente);
    },
  );

  it('Werte zwischen Stufen werden auf den nächsten Tabellenwert aufgerundet (MB 3.01 Ziff. 30)', () => {
    expect(mdjeTabellenwert(35477, r)).toBe(36288);
    expect(ahvRenteSkala44(35477, r)).toBe(1719);
    expect(mdjeTabellenwert(46268, r)).toBe(46872);
    expect(ahvRenteSkala44(46268, r)).toBe(1935);
    expect(ahvRenteSkala44(0, r)).toBe(1260);
    expect(ahvRenteSkala44(500000, r)).toBe(2520);
  });
});

describe('volle Beitragsdauer', () => {
  it('Männer: 44 Jahre, Frau Jg. 1962 (RA 64 J. 6 Mt.): 43 Jahre wie im Merkblatt-Beispiel', () => {
    expect(ahvVolleBeitragsdauer(1961, 9, 'm', regeln)).toBe(44);
    expect(ahvVolleBeitragsdauer(1962, 2, 'w', regeln)).toBe(43);
    expect(ahvVolleBeitragsdauer(1980, 1, 'w', regeln)).toBe(44);
  });
});

describe('ahvSchaetzung', () => {
  it('Merkblatt 3.01 Beispiel 30 (Frau, Jg. 1962, 18 Erziehungsjahre in der Ehe) → 1719', () => {
    // Durchschnitt Erwerbseinkommen gemäss Merkblatt 25'983 (inkl. Aufwertung 1,025)
    const e = ahvSchaetzung(
      eingabe({
        geburtsjahr: 1962,
        geburtsmonat: 2,
        geschlecht: 'w',
        einkommen: 25983,
        einkommenEhepartner: 25983,
        erziehungsJahre: 18,
        ehejahre: 43,
      }),
      regeln,
    );
    expect(e.vollDauer).toBe(43);
    expect(e.beitragsjahre).toBe(43);
    expect(Math.round(e.durchschnittErziehung)).toBe(9494);
    expect(e.mdjeTabelle).toBe(36288);
    expect(e.renteMonat).toBe(1719);
  });

  it('Merkblatt 3.01 Beispiel 31 (Mann, Jg. 1961, Erziehungsgutschrift ÷ 44 ÷ 2) → 1935', () => {
    const e = ahvSchaetzung(
      eingabe({
        geburtsjahr: 1961,
        geburtsmonat: 9,
        einkommen: 36990,
        einkommenEhepartner: 36990,
        erziehungsJahre: 18,
        ehejahre: 41,
      }),
      regeln,
    );
    expect(Math.round(e.durchschnittErziehung)).toBe(9278);
    expect(e.mdjeTabelle).toBe(46872);
    expect(e.renteMonat).toBe(1935);
  });

  it("Merkblatt 3.01 Beispiel 31 mit Splitting (Frau): Durchschnitt nahe 34'360 (ohne Aufwertung)", () => {
    // Frau: 25'000 vor der Ehe (2 J.), 1'065'000 während 41 Ehejahren; Mann während der Ehe 1'840'000.
    // Offiziell (ungeteilt + geteilt) ÷ 43 = 34'360 vor Aufwertung. Die Schätzhilfe kennt nur einen
    // Durchschnitt pro Person → kleine Abweichung.
    const e = ahvSchaetzung(
      eingabe({
        geburtsjahr: 1962,
        geburtsmonat: 2,
        geschlecht: 'w',
        einkommen: (25000 + 1065000) / 43,
        ehejahre: 41,
        einkommenEhepartner: 1840000 / 41,
      }),
      regeln,
    );
    expect(Math.abs(e.durchschnittErwerb / 34360 - 1)).toBeLessThan(0.01);
  });

  it('Splitting: Einkommen der Ehejahre je hälftig', () => {
    // 44 Jahre, davon 20 verheiratet; eigenes Einkommen 100'000, Partner 0
    const e = ahvSchaetzung(eingabe({ einkommen: 100000, ehejahre: 20, einkommenEhepartner: 0 }), regeln);
    expect(e.durchschnittErwerb).toBeCloseTo((24 * 100000 + 20 * 50000) / 44, 6);
    const p = ahvSchaetzung(eingabe({ einkommen: 0, ehejahre: 44, einkommenEhepartner: 120000 }), regeln);
    expect(p.durchschnittErwerb).toBeCloseTo(60000, 6);
    expect(p.renteMonat).toBe(2117); // 60'480 → 2'117
  });

  it("Erziehungsgutschrift = 3 × jährliche Minimalrente (45'360), ausserhalb der Ehe ganz", () => {
    const e = ahvSchaetzung(eingabe({ einkommen: 0, erziehungsJahre: 11 }), regeln);
    expect(e.durchschnittErziehung).toBeCloseTo((11 * 45360) / 44, 6);
  });

  it('Maximalrente bei hohem Einkommen und voller Beitragsdauer', () => {
    expect(ahvSchaetzung(eingabe({ einkommen: 150000 }), regeln).renteMonat).toBe(2520);
  });

  it('Minimalrente ohne Einkommen bei voller Beitragsdauer', () => {
    expect(ahvSchaetzung(eingabe({ einkommen: 0 }), regeln).renteMonat).toBe(1260);
  });

  it('pro fehlendes Beitragsjahr 1/44 weniger (Männer)', () => {
    const e = ahvSchaetzung(eingabe({ einkommen: 150000, luecken: 4 }), regeln);
    expect(e.beitragsjahre).toBe(40);
    expect(e.renteMonat).toBe(Math.round((2520 * 40) / 44));
    expect(e.beitragsjahreSkala44).toBe(40);
  });

  it('Modus «Jahre in der Schweiz»', () => {
    const e = ahvSchaetzung(eingabe({ einkommen: 150000, beitragsModus: 'jahreCh', jahreCh: 22 }), regeln);
    expect(e.beitragsjahre).toBe(22);
    expect(e.renteMonat).toBe(1260);
  });

  it('Auslandsjahre erhöhen die Schweizer Rente nicht und erzeugen einen Hinweis', () => {
    const ohne = ahvSchaetzung(eingabe({ einkommen: 150000 }), regeln);
    const mit = ahvSchaetzung(eingabe({ einkommen: 150000, ausland: true, auslandJahre: 10 }), regeln);
    expect(mit.renteMonat).toBeLessThan(ohne.renteMonat);
    expect(mit.beitragsjahre).toBe(34);
    expect(mit.hinweise.join(' ')).toMatch(/ausländische Rente/);
    const jahreCh = ahvSchaetzung(
      eingabe({ einkommen: 150000, beitragsModus: 'jahreCh', jahreCh: 34, ausland: true, auslandJahre: 10 }),
      regeln,
    );
    expect(jahreCh.renteMonat).toBe(mit.renteMonat);
  });

  it('ohne Beitragsjahre keine Rente', () => {
    expect(ahvSchaetzung(eingabe({ beitragsModus: 'jahreCh', jahreCh: 0 }), regeln).renteMonat).toBe(0);
  });

  it('ungültige Eingaben (negativ, NaN) werden neutralisiert', () => {
    const e = ahvSchaetzung(eingabe({ einkommen: Number.NaN, luecken: -5, ehejahre: -1 }), regeln);
    expect(e.renteMonat).toBe(1260);
  });
});
