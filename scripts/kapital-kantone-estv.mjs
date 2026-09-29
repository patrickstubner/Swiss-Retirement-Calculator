/**
 * Erzeugt data/kapital-kantone-2026.json: Kapitalleistungssteuer aus Vorsorge (PK, Freizügigkeit, 3a) bei Wohnsitz
 * in der Schweiz, alle 26 Kantone (Kantonshauptort, ohne Kirchensteuer), Steuerjahr 2026, je Zivilstand.
 * Quelle: ESTV-Steuerrechner, Funktion «Kapitalleistungen» (API_calculateManyCapitalTaxes), abgerufen zur Build-Zeit.
 * Die Nutzungsbedingungen der (undokumentierten) API sind OFFEN; die App ruft sie nicht zur Laufzeit auf.
 * Aufruf: node scripts/kapital-kantone-estv.mjs
 */
import { writeFileSync } from 'node:fs';

const B = 'https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV/';
const BETRAEGE = [
  10000, 25000, 50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000,
  600000, 700000, 800000, 900000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000, 4000000, 5000000,
];

async function call(p) {
  const r = await fetch(`${B}API_calculateManyCapitalTaxes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  return (await r.json()).response;
}

const out = {
  quelle:
    'https://swisstaxcalculator.estv.admin.ch (ESTV-Steuerrechner, Kapitalleistungen aus Vorsorge, Steuerjahr 2026)',
  stand: `abgerufen ${new Date().toISOString().slice(0, 10)}`,
  hinweis:
    'Steuer in CHF auf die Kapitalleistung: kanton = Kantons- plus Gemeindesteuer des Kantonshauptorts (ohne Kirchensteuer), bund = direkte Bundessteuer. Stützpunkte [Betrag, kanton, bund]; Zwischenwerte werden über den Satz interpoliert.',
  betraege: BETRAEGE,
  kantone: {},
};
for (const [zs, rel] of [
  ['alleinstehend', 1],
  ['verheiratet', 2],
]) {
  for (const betrag of BETRAEGE) {
    const rr = await call({
      SimKey: null,
      TaxYear: 2026,
      TaxGroupID: 88,
      Relationship: rel,
      Confession1: 4,
      Confession2: rel === 2 ? 4 : 0,
      NumberOfChildren: 0,
      Gender: 1,
      AgeAtPayment: 65,
      Capital: betrag,
    });
    for (const r of rr) {
      if (!out.kantone[r.Location.Canton])
        out.kantone[r.Location.Canton] = { hauptort: r.Location.BfsName, alleinstehend: [], verheiratet: [] };
      const k = out.kantone[r.Location.Canton];
      k[zs].push([betrag, r.TaxCanton + r.TaxCity, r.TaxFed]);
    }
    await new Promise((res) => setTimeout(res, 250));
  }
}
writeFileSync(new URL('../data/kapital-kantone-2026.json', import.meta.url), `${JSON.stringify(out)}\n`);
console.log(Object.keys(out.kantone).length, 'Kantone');
