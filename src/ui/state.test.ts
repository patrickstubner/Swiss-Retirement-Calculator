import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { effektiverHaushalt } from '../core/schaetzwerte';
import type { Haushalt } from '../core/typen';
import {
  neueAusgabenPhase,
  neuePerson,
  neuesAusgabenEinzeljahr,
  neuesTodesfall,
  neuesWohneigentum,
  standardHaushalt,
} from '../data/defaults';
import { ladeRegeln } from '../rules';
import {
  ALTE_KEYS,
  AUS_KEY,
  dekodiere,
  kodiere,
  ladeLokal,
  ladeStartzustand,
  modusFuerLink,
  normalisiere,
  SCHEMA_VERSION,
  SPEICHER_VERSION,
  STANDARD_UI,
  STORAGE_KEY,
  setzeSpeichern,
  speichereLokal,
  speichernAktiv,
  teilenLink,
} from './state';
import { exportiere, importiere } from './szenarien';
import { AHV_VERSCHIEBUNG_MIN } from './validierung';

/** Einfacher Storage-Ersatz (Tests laufen in Node ohne localStorage). */
class TestSpeicher implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  schluessel() {
    return [...this.m.keys()];
  }
}

const regeln = ladeRegeln(2026);

/** Frau der Übergangsgeneration, gesetzlicher Höchstvorbezug. Jahrgang ist die Kohorte, kein Personenbezug. */
function haushaltVorbezug36() {
  const h = standardHaushalt(regeln);
  const p = h.personen[0];
  if (!p) throw new Error('Person fehlt');
  h.personen[0] = {
    ...p,
    geburtsjahr: 1965,
    geburtsmonat: 6,
    geschlecht: 'w',
    ahv: { ...p.ahv, bezugVerschiebungMonate: -36 },
  };
  return h;
}

describe('Zustand (URL-Fragment)', () => {
  it('Frau Jahrgang 1965 mit Vorbezug −36 bleibt −36 nach Link, Datei und lokalem Speicher', () => {
    expect(AHV_VERSCHIEBUNG_MIN).toBe(-36);
    const h = haushaltVorbezug36();
    const ausLink = dekodiere(kodiere(h), regeln);
    expect(ausLink?.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);
    expect(ausLink?.personen[0]?.geburtsjahr).toBe(1965);
    expect(ausLink?.personen[0]?.geschlecht).toBe('w');

    const s = new TestSpeicher();
    const link = teilenLink(h, 'https://example.org/');
    const start = ladeStartzustand(regeln, link.slice(link.indexOf('#')), s);
    expect(start.quelle).toBe('link');
    expect(start.haushalt.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);

    speichereLokal(s, { haushalt: h, ui: STANDARD_UI });
    expect(ladeLokal(s, regeln)?.haushalt.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);
    expect(ladeStartzustand(regeln, '', s).haushalt.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);

    const datei = importiere(exportiere(h, standardHaushalt(regeln), { a: 'Version A', b: 'Version B' }), regeln);
    expect(datei?.a.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);

    const zuWeit = haushaltVorbezug36();
    const p = zuWeit.personen[0];
    if (!p) throw new Error('Person fehlt');
    zuWeit.personen[0] = { ...p, ahv: { ...p.ahv, bezugVerschiebungMonate: -48 } };
    expect(dekodiere(kodiere(zuWeit), regeln)?.personen[0]?.ahv.bezugVerschiebungMonate).toBe(-36);
  });

  it('Kodieren und Dekodieren ergibt denselben Haushalt', () => {
    const h = standardHaushalt(regeln);
    h.personen[0] = {
      ...(h.personen[0] as (typeof h.personen)[number]),
      wohneigentum: neuesWohneigentum(regeln, { vorhanden: true, verkehrswert: 800000, hypothek: 300000 }),
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });

  it('Ehepaar: zwei vollständig individuelle Personen', () => {
    const h = normalisiere(
      {
        zivilstand: 'verheiratet',
        personen: [
          { geburtsjahr: 1962, geschlecht: 'w' },
          { geburtsjahr: 1958, bargeld: 5 },
        ],
      },
      regeln,
    );
    expect(h.personen).toHaveLength(2);
    expect(h.personen[0]?.geschlecht).toBe('w');
    expect(h.personen[1]?.geburtsjahr).toBe(1958);
    expect(h.personen[1]?.bargeld).toBe(5);
    expect(h.personen[1]?.wohneigentum.hypothek).toBe(0);
  });

  it('migriert frühere Felder freiesVermoegen/vermoegen zu Wertschriften', () => {
    expect(
      normalisiere({ freiesVermoegen: 123000, personen: [{ geburtsjahr: 1970 }] }, regeln).personen[0]?.wertschriften,
    ).toBe(123000);
    expect(normalisiere({ personen: [{ vermoegen: 7 }] }, regeln).personen[0]?.wertschriften).toBe(7);
  });

  it('Standardwerte sind neutral (keine Beispielvermögen)', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0];
    expect(p?.lohn).toBe(0);
    expect(p?.bargeld).toBe(0);
    expect(p?.wertschriften).toBe(0);
    expect(p?.pk.guthaben).toBe(0);
    expect(p?.saeule3a.guthaben).toBe(0);
    expect(p?.ahv.renteMonat).toBe(0);
    expect(h.ausgaben.lebenshaltung).toBe(0);
  });

  it('Posten und Ereignisse werden normalisiert', () => {
    const h = normalisiere(
      {
        posten: [{ art: 'einnahme', betragJahr: 1000, person: 5, indexierung: { art: 'satz', satz: 0.02 } }],
        ereignisse: [{ betrag: -5 }],
      },
      regeln,
    );
    expect(h.posten[0]?.art).toBe('einnahme');
    expect(h.posten[0]?.person).toBe(0);
    expect(h.posten[0]?.indexierung).toEqual({ art: 'satz', satz: 0.02 });
    expect(h.ereignisse[0]?.betrag).toBe(-5);
  });

  it('Planungsalter bis 999, Standard 120', () => {
    expect(normalisiere({}, regeln).planungsalter).toBe(120);
    expect(normalisiere({ planungsalter: 5000 }, regeln).planungsalter).toBe(999);
  });
});

describe('Speichern im Browser (localStorage)', () => {
  const ui = { schritt: 2, suchModus: 'gemeinsam' as const, modus: 'detailliert' as const };
  const mitLohn = () => {
    const h = standardHaushalt(regeln);
    (h.personen[0] as (typeof h.personen)[number]).lohn = 123456;
    return h;
  };

  it('ist standardmässig an und speichert den ganzen Zustand als EIN JSON-Objekt mit Version', () => {
    const s = new TestSpeicher();
    expect(speichernAktiv(s)).toBe(true);
    speichereLokal(s, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
    const obj = JSON.parse(s.getItem(STORAGE_KEY) ?? '{}');
    expect(obj.version).toBe(SPEICHER_VERSION);
    expect(obj.haushalt.personen[0].lohn).toBe(123456);
    expect(obj.ui).toEqual(ui);
  });

  it('stellt den Zustand beim Laden wieder her (inkl. Oberflächenzustand)', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    const z = ladeLokal(s, regeln);
    expect(z?.haushalt.personen[0]?.lohn).toBe(123456);
    expect(z?.ui).toEqual(ui);
    expect(ladeStartzustand(regeln, '', s).quelle).toBe('lokal');
  });

  it('Ausschalten löscht sofort alle Daten (auch frühere Schlüssel) und speichert nichts mehr', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    for (const k of ALTE_KEYS) s.setItem(k, 'alt');
    setzeSpeichern(s, false, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([AUS_KEY]);
    expect(s.getItem(AUS_KEY)).toBe('1');
    speichereLokal(s, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([AUS_KEY]);
    expect(speichernAktiv(s)).toBe(false);
    expect(ladeStartzustand(regeln, '', s).quelle).toBe('standard');
  });

  it('Wiedereinschalten entfernt das Merkmal «aus» und speichert sofort', () => {
    const s = new TestSpeicher();
    setzeSpeichern(s, false, { haushalt: mitLohn(), ui });
    setzeSpeichern(s, true, { haushalt: mitLohn(), ui });
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
  });

  it('migriert die frühere Opt-in-Speicherung und löscht die alten Schlüssel', () => {
    const s = new TestSpeicher();
    s.setItem('ruhestandsrechner:zustand', kodiere(mitLohn()));
    s.setItem('ruhestandsrechner:speichern', '1');
    const z = ladeLokal(s, regeln);
    expect(z?.haushalt.personen[0]?.lohn).toBe(123456);
    expect(s.schluessel()).toEqual([STORAGE_KEY]);
  });

  it('ein geteilter Link hat Vorrang vor dem localStorage (die eigenen Daten bleiben erhalten)', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: mitLohn(), ui });
    const geteilt = standardHaushalt(regeln);
    (geteilt.personen[0] as (typeof geteilt.personen)[number]).lohn = 777;
    const link = teilenLink(geteilt, 'https://example.org/app/#alt');
    expect(link.startsWith('https://example.org/app/#s=')).toBe(true);
    const start = ladeStartzustand(regeln, link.slice(link.indexOf('#')), s);
    expect(start.quelle).toBe('link');
    expect(start.haushalt.personen[0]?.lohn).toBe(777);
    expect(start.lokal?.haushalt.personen[0]?.lohn).toBe(123456);
  });

  it('defekte Einträge werden ignoriert', () => {
    const s = new TestSpeicher();
    s.setItem(STORAGE_KEY, '{kaputt');
    expect(ladeLokal(s, regeln)).toBeNull();
    expect(ladeStartzustand(regeln, '', null).quelle).toBe('standard');
  });
});

describe('Neue Felder: Rücktrittsmodus und Wohnsitz im Ausland', () => {
  it('Standard: Modus Alter, kein Wegzug', () => {
    const p = standardHaushalt(regeln).personen[0];
    expect(p?.stoppModus).toBe('alter');
    expect(p?.wohnsitzAusland.aktiv).toBe(false);
  });

  it('ungültige Werte werden normalisiert', () => {
    const p = normalisiere(
      {
        personen: [
          {
            stoppModus: 'x',
            stoppDatum: { jahr: 2027.4, monat: 13 },
            wohnsitzAusland: {
              aktiv: true,
              modus: 'datum',
              land: 'ZZ',
              nationalitaet: 'foo',
              sitzkantonVorsorge: 'XY',
              barauszahlung: 'ja',
            },
          },
        ],
      },
      regeln,
    ).personen[0];
    expect(p?.stoppModus).toBe('alter');
    expect(p?.stoppDatum).toEqual({ jahr: 2027, monat: 12 });
    expect(p?.wohnsitzAusland.modus).toBe('datum');
    expect(p?.wohnsitzAusland.land).toBe('');
    expect(p?.wohnsitzAusland.nationalitaet).toBe('CH');
    expect(p?.wohnsitzAusland.sitzkantonVorsorge).toBe('');
    expect(p?.wohnsitzAusland.barauszahlung).toBe(true);
    expect(p?.wohnsitzAusland.nichtObligatorischVersichert).toBe(false);
  });

  it('Datum-Modus und Wegzug überstehen Kodieren/Dekodieren', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    h.personen[0] = {
      ...p,
      stoppModus: 'datum',
      stoppDatum: { jahr: 2027, monat: 11 },
      wohnsitzAusland: { ...p.wohnsitzAusland, aktiv: true, land: 'PY', nationalitaet: 'EU', freiwilligeAhv: true },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });

  it('Schema 3: Steuern im Zielland – Roundtrip, Migration und Bereinigung', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    h.personen[0] = {
      ...p,
      wohnsitzAusland: {
        ...p.wohnsitzAusland,
        aktiv: true,
        land: 'IT',
        steuerOption: 'it7',
        qstKapitalRueckforderung: true,
        steuerSatzZielland: 0.12,
        steuerSatzKapitalZielland: 0.03,
      },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
    // Schema 2 (ohne die neuen Felder): Standardwerte
    const alt = JSON.parse(JSON.stringify(h)) as { personen: { wohnsitzAusland: Record<string, unknown> }[] };
    const w = alt.personen[0]?.wohnsitzAusland ?? {};
    delete w.steuerOption;
    delete w.qstKapitalRueckforderung;
    delete w.steuerSatzZielland;
    delete w.steuerSatzKapitalZielland;
    const m = normalisiere(alt, regeln).personen[0]?.wohnsitzAusland;
    expect(m?.steuerSatzZielland).toBeNull();
    expect(m?.steuerOption).toBe('');
    expect(m?.qstKapitalRueckforderung).toBe(false);
    // unbekannte Option und unplausible Sätze werden bereinigt
    w.steuerOption = 'azoren';
    w.steuerSatzZielland = 5;
    w.steuerSatzKapitalZielland = -1;
    const b = normalisiere(alt, regeln).personen[0]?.wohnsitzAusland;
    expect(b?.steuerOption).toBe('');
    expect(b?.steuerSatzZielland).toBe(0.6);
    expect(b?.steuerSatzKapitalZielland).toBe(0);
    expect(modusFuerLink(normalisiere(alt, regeln), regeln)).toBe('detailliert');
  });

  it('Schema 4: Erwerbsstatus, frühere Erwerbstätigkeit und Betreuungsjahre – Roundtrip und Migration', () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    h.personen[0] = {
      ...p,
      erwerbsstatus: 'nichtErwerbstaetig',
      frueherErwerb: { jahre: 8, lohn: 55_000 },
      ahvSchaetzhilfe: { ...p.ahvSchaetzhilfe, erziehungsJahre: 7, betreuungsJahre: 3 },
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
    // Schema 3 (ohne die neuen Felder): erwerbstätig, keine früheren Jahre, keine Betreuung
    const alt = JSON.parse(JSON.stringify(h)) as { personen: Record<string, unknown>[] };
    const q = alt.personen[0] ?? {};
    delete q.erwerbsstatus;
    delete q.frueherErwerb;
    delete (q.ahvSchaetzhilfe as Record<string, unknown>).betreuungsJahre;
    const m = normalisiere(alt, regeln).personen[0];
    expect(m?.erwerbsstatus).toBe('erwerbstaetig');
    expect(m?.frueherErwerb).toEqual({ jahre: 0, lohn: 0 });
    expect(m?.ahvSchaetzhilfe.betreuungsJahre).toBe(0);
    // unbekannter Status und unplausible Werte werden bereinigt
    q.erwerbsstatus = 'rentner';
    q.frueherErwerb = { jahre: 99.4, lohn: -5 };
    const b = normalisiere(alt, regeln).personen[0];
    expect(b?.erwerbsstatus).toBe('erwerbstaetig');
    expect(b?.frueherErwerb).toEqual({ jahre: 50, lohn: 0 });
  });

  it('Schema 6: Krisenmodus und Aktienanteil – Roundtrip und Migration', () => {
    const h = standardHaushalt(regeln);
    h.annahmen = { ...h.annahmen, aktienanteil: 0.7 };
    h.krisen = {
      ...h.krisen,
      modus: 'individuell',
      mcAktiv: true,
      mcArt: 'bootstrap',
      mcKrisenProDekade: 1,
      autoProDekade: 1.2,
      autoStartArt: 'nachRuecktritt',
      autoStartJahr: 2040,
      autoJahreNach: 3,
      auswahl: [
        {
          uid: 'a',
          id: 'finanzkrise2007',
          land: 'CHE',
          startArt: 'nachRuecktritt',
          jahr: 2030,
          alter: 70,
          person: 0,
          jahreNach: 2,
        },
        {
          uid: 'b',
          id: 'depression1929',
          land: 'USA',
          startArt: 'alter',
          jahr: 2035,
          alter: 72,
          person: 0,
          jahreNach: 0,
        },
      ],
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
    // Schema 4 (ohne Krisen, ohne Aktienanteil): Standardwerte
    const alt = JSON.parse(JSON.stringify(h)) as Record<string, unknown>;
    delete alt.krisen;
    delete (alt.annahmen as Record<string, unknown>).aktienanteil;
    const m = normalisiere(alt, regeln);
    expect(m.krisen.modus).toBe('keine');
    expect(m.krisen.auswahl).toEqual([]);
    expect(m.krisen.mcKrisenProDekade).toBeNull();
    expect(m.krisen.autoStartJahr).toBeNull();
    expect(m.annahmen.aktienanteil).toBe(0.5);
    // unbekannte Krisen, Reihen und Modi werden bereinigt
    const fremd = JSON.parse(JSON.stringify(h)) as {
      krisen: { auswahl: Record<string, unknown>[]; mcLaeufe: number; modus: string; autoProDekade: number };
    };
    fremd.krisen.auswahl.push({ uid: 'c', id: 'erfunden', land: 'CHE' });
    (fremd.krisen.auswahl[0] as Record<string, unknown>).land = 'XYZ';
    fremd.krisen.mcLaeufe = 1e9;
    fremd.krisen.modus = 'irgendwas';
    fremd.krisen.autoProDekade = 99;
    const b = normalisiere(fremd, regeln);
    expect(b.krisen.auswahl.map((x) => x.id)).toEqual(['finanzkrise2007', 'depression1929']);
    expect(b.krisen.auswahl[0]?.land).toBe('CHE');
    expect(b.krisen.mcLaeufe).toBe(2000);
    expect(b.krisen.modus).toBe('keine');
    expect(b.krisen.autoProDekade).toBe(5);
  });

  it('Migration Schema 5 → 6: «aktiv» mit Krisen wird «Individuell», sonst «Keine Krise»', () => {
    const def = standardHaushalt(regeln);
    const v5 = (aktiv: boolean, auswahl: unknown[]) => {
      const roh = JSON.parse(JSON.stringify(def)) as Record<string, unknown>;
      roh.krisen = {
        aktiv,
        auswahl,
        mcAktiv: false,
        mcArt: 'wiederkehrend',
        mcKrisenProDekade: null,
        mcLaeufe: 300,
        mcBlockLaenge: 5,
      };
      return roh;
    };
    const eintrag = { uid: 'x', id: 'dotcom2000', land: 'CHE', startArt: 'jahr', jahr: 2031, jahreNach: 0 };
    const a = normalisiere(v5(true, [eintrag]), regeln).krisen;
    expect(a.modus).toBe('individuell');
    expect(a.auswahl[0]).toMatchObject({ id: 'dotcom2000', startArt: 'jahr', jahr: 2031, alter: 70, person: 0 });
    expect('aktiv' in a).toBe(false);
    expect(normalisiere(v5(false, [eintrag]), regeln).krisen.modus).toBe('keine');
    expect(normalisiere(v5(true, []), regeln).krisen.modus).toBe('keine');
    // Share-Link bzw. localStorage in Version 5
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 5, h: v5(true, [eintrag]) }));
    expect(dekodiere(code, regeln)?.krisen.modus).toBe('individuell');
  });

  it('Erster Start: Krisenmodus «Automatisch»; gespeicherte Stände und Links behalten ihren Modus', () => {
    // ohne gespeicherte Daten und ohne Link
    const z = ladeStartzustand(regeln, '', new TestSpeicher());
    expect(z.quelle).toBe('standard');
    expect(z.haushalt.krisen.modus).toBe('automatisch');
    // Schema 6 mit gewähltem «Keine Krise»: bleibt (Link und localStorage)
    const h = standardHaushalt(regeln);
    h.krisen = { ...h.krisen, modus: 'keine' };
    expect(dekodiere(kodiere(h), regeln)?.krisen.modus).toBe('keine');
    expect(ladeStartzustand(regeln, `#s=${kodiere(h)}`, new TestSpeicher()).haushalt.krisen.modus).toBe('keine');
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: h, ui: STANDARD_UI });
    expect(ladeStartzustand(regeln, '', s).haushalt.krisen.modus).toBe('keine');
    // Schema 5 ohne Krise und Schema ≤ 4 ohne `krisen`: «Keine Krise» (nicht der neue Standard)
    const v5 = JSON.parse(JSON.stringify(standardHaushalt(regeln))) as Record<string, unknown>;
    v5.krisen = { aktiv: false, auswahl: [], mcAktiv: false, mcArt: 'wiederkehrend', mcKrisenProDekade: null };
    expect(
      dekodiere(LZString.compressToEncodedURIComponent(JSON.stringify({ v: 5, h: v5 })), regeln)?.krisen.modus,
    ).toBe('keine');
    delete v5.krisen;
    expect(
      dekodiere(LZString.compressToEncodedURIComponent(JSON.stringify({ v: 4, h: v5 })), regeln)?.krisen.modus,
    ).toBe('keine');
  });
});

describe('Schema 7: Wohneigentum mit Wohnkosten und Verkauf', () => {
  it('Schema 6 (ohne neue Felder) lädt mit Standardwerten: kein Verkauf, Wohnkosten in den Ausgaben', () => {
    const h6 = JSON.parse(JSON.stringify(standardHaushalt(regeln))) as Record<string, unknown>;
    delete h6.wohnen;
    const personen = h6.personen as Record<string, unknown>[];
    (personen[0] as Record<string, unknown>).wohneigentum = {
      vorhanden: true,
      verkehrswert: 900_000,
      hypothek: 350_000,
    };
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 6, h: h6 }));
    const h = dekodiere(code, regeln);
    expect(h?.wohnen).toEqual({ separat: false, mieteMonat: 0 });
    expect(h?.personen[0]?.wohneigentum).toEqual(
      neuesWohneigentum(regeln, { vorhanden: true, verkehrswert: 900_000, hypothek: 350_000 }),
    );
    // gespeicherter Stand (localStorage) ebenso
    const s = new TestSpeicher();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'ruhestandsrechner', version: 1, schema: 6, haushalt: h6, ui: STANDARD_UI }),
    );
    expect(ladeLokal(s, regeln)?.haushalt.personen[0]?.wohneigentum.verkauf.aktiv).toBe(false);
  });

  it('Roundtrip und Bereinigung ungültiger Werte', () => {
    const h = standardHaushalt(regeln);
    h.wohnen = { separat: true, mieteMonat: 2_400 };
    h.personen[0] = {
      ...(h.personen[0] as (typeof h.personen)[number]),
      wohneigentum: neuesWohneigentum(regeln, {
        vorhanden: true,
        verkehrswert: 700_000,
        hypothek: 200_000,
        unterhaltArt: 'chf',
        unterhaltChf: 8_000,
        nachWegzug: 'vermietet',
        mieteinnahmenMonat: 2_000,
        verkauf: {
          ...neuesWohneigentum(regeln).verkauf,
          aktiv: true,
          zeitpunkt: 'datum',
          datum: { jahr: 2033, monat: 4 },
          anlagekosten: 450_000,
          eigenerSatz: 0.1,
        },
      }),
    };
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
    const roh = JSON.parse(JSON.stringify(h)) as Haushalt;
    const w = roh.personen[0]?.wohneigentum as unknown as Record<string, unknown>;
    w.unterhaltArt = 'x';
    w.nachWegzug = 'y';
    w.hypothekarzins = 5;
    (w.verkauf as Record<string, unknown>).zeitpunkt = 'irgendwann';
    const n = normalisiere(roh, regeln).personen[0]?.wohneigentum;
    expect(n?.unterhaltArt).toBe('prozent');
    expect(n?.nachWegzug).toBe('leer');
    expect(n?.hypothekarzins).toBe(0.2);
    expect(n?.verkauf.zeitpunkt).toBe('wegzug');
  });
});

describe('Eingabemodus «Schnell» / «Detailliert»', () => {
  const detailHaushalt = () => {
    const h = standardHaushalt(regeln);
    const p = h.personen[0] as (typeof h.personen)[number];
    p.lohn = 110000;
    p.inChSeit = 2014;
    p.bargeld = 20000;
    p.ahv = { ...p.ahv, modus: 'eingabe', renteMonat: 2100 };
    p.pk = { ...p.pk, umwandlungssatz: 0.052, guthaben: 350000 };
    p.manuell = { ahvRente: true, pkUmwandlungssatz: true, pkGuthaben: true };
    return h;
  };

  it('frischer Zustand startet im Modus «Schnell» (auch ohne Speicher oder mit Speichern aus)', () => {
    expect(ladeStartzustand(regeln, '', new TestSpeicher()).ui.modus).toBe('schnell');
    expect(ladeStartzustand(regeln, '', null).ui.modus).toBe('schnell');
    const aus = new TestSpeicher();
    aus.setItem(AUS_KEY, '1');
    expect(ladeStartzustand(regeln, '', aus).ui.modus).toBe('schnell');
    expect(STANDARD_UI.modus).toBe('schnell');
  });

  it('Erststart: Umwandlungssatz geschätzt (aufgeteilt), nicht als eigene Eingabe markiert', () => {
    const start = ladeStartzustand(regeln, '', new TestSpeicher());
    const p = start.haushalt.personen[0];
    expect(p?.manuell.pkUmwandlungssatz).toBeUndefined();
    const e = effektiverHaushalt(start.haushalt, regeln, { jahr: 2026, monat: 9 });
    expect(e.schaetzungen.some((x) => x.feld === 'pkUmwandlungssatz')).toBe(true);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(e.umwandlungssatz[0]?.satz);
  });

  it('Link ohne Detailwerte → «Schnell», auch wenn lokal «Detailliert» gespeichert ist', () => {
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: detailHaushalt(), ui: { schritt: 1, suchModus: 'gemeinsam', modus: 'detailliert' } });
    const einfach = standardHaushalt(regeln);
    const hash = teilenLink(einfach, 'https://x/').slice('https://x/'.length);
    const z = ladeStartzustand(regeln, hash, s);
    expect(z.quelle).toBe('link');
    expect(z.ui.modus).toBe('schnell');
    // BVG-Altersguthaben (nur im Modus «Detailliert» sichtbar) → Link öffnet «Detailliert»
    const p0 = einfach.personen[0] as (typeof einfach.personen)[number];
    p0.pk = { ...p0.pk, bvgGuthaben: 120000 };
    expect(modusFuerLink(einfach, regeln)).toBe('detailliert');
    expect(dekodiere(kodiere(einfach), regeln)?.personen[0]?.pk.bvgGuthaben).toBe(120000);
  });

  it('der gespeicherte Modus bleibt erhalten; frühere Zustände ohne Modus → «Detailliert»', () => {
    for (const modus of ['schnell', 'detailliert'] as const) {
      const s = new TestSpeicher();
      speichereLokal(s, { haushalt: standardHaushalt(regeln), ui: { schritt: 1, suchModus: 'gemeinsam', modus } });
      expect(ladeStartzustand(regeln, '', s).ui.modus).toBe(modus);
    }
    const s = new TestSpeicher();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'ruhestandsrechner', version: 1, schema: 1, haushalt: {}, ui: { schritt: 2 } }),
    );
    expect(ladeLokal(s, regeln)?.ui.modus).toBe('detailliert');
  });

  it('Moduswechsel verliert keine Daten: Detailwerte überstehen Speichern im Modus «Schnell»', () => {
    const h = normalisiere(detailHaushalt(), regeln);
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: h, ui: { schritt: 2, suchModus: 'gemeinsam', modus: 'detailliert' } });
    // Wechsel zu «Schnell» (nur der Modus ändert) und wieder zurück
    const z1 = ladeLokal(s, regeln);
    speichereLokal(s, { haushalt: z1?.haushalt ?? h, ui: { schritt: 0, suchModus: 'gemeinsam', modus: 'schnell' } });
    const z2 = ladeLokal(s, regeln);
    expect(z2?.ui.modus).toBe('schnell');
    expect(z2?.haushalt).toEqual(h);
    speichereLokal(s, {
      haushalt: z2?.haushalt ?? h,
      ui: { schritt: 0, suchModus: 'gemeinsam', modus: 'detailliert' },
    });
    expect(ladeLokal(s, regeln)?.haushalt).toEqual(h);
    // «Schnell» rechnet mit den Detailwerten
    const e = effektiverHaushalt(h, regeln, { jahr: 2026, monat: 9 });
    expect(e.haushalt.personen[0]?.ahv.renteMonat).toBe(2100);
    expect(e.haushalt.personen[0]?.pk.umwandlungssatz).toBe(0.052);
    expect(e.schaetzungen.map((x) => x.feld)).toEqual(['pkSparbeitrag']);
  });

  it('«in der Schweiz seit» und Markierungen werden normalisiert; Kodieren/Dekodieren behält sie', () => {
    const h = detailHaushalt();
    expect(dekodiere(kodiere(h), regeln)?.personen[0]?.manuell).toEqual(h.personen[0]?.manuell);
    expect(dekodiere(kodiere(h), regeln)?.personen[0]?.inChSeit).toBe(2014);
    const roh = JSON.parse(JSON.stringify(h));
    roh.personen[0].inChSeit = 'x';
    roh.personen[0].manuell = { ahvRente: true, unbekannt: true, pkGuthaben: 'ja' };
    const n = normalisiere(roh, regeln);
    expect(n.personen[0]?.inChSeit).toBe(0);
    expect(n.personen[0]?.manuell).toEqual({ ahvRente: true });
  });

  it('frühere Zustände ohne Markierungen: abweichende Werte gelten als eigene Eingabe', () => {
    const roh = JSON.parse(JSON.stringify(detailHaushalt()));
    delete roh.personen[0].manuell;
    const n = normalisiere(roh, regeln);
    expect(n.personen[0]?.manuell).toEqual({ ahvRente: true, pkGuthaben: true, pkUmwandlungssatz: true });
  });

  it('geteilter Link: «Detailliert», wenn er Detailwerte enthält, sonst «Schnell»', () => {
    const einfach = standardHaushalt(regeln);
    (einfach.personen[0] as (typeof einfach.personen)[number]).lohn = 90000;
    expect(modusFuerLink(einfach, regeln)).toBe('schnell');
    // PK-Guthaben und Umwandlungssatz sind Schnell-Felder
    const p0 = einfach.personen[0] as (typeof einfach.personen)[number];
    p0.manuell = { pkGuthaben: true, pkUmwandlungssatz: true };
    p0.pk = { ...p0.pk, guthaben: 300000, umwandlungssatz: 0.055 };
    expect(modusFuerLink(einfach, regeln)).toBe('schnell');
    expect(modusFuerLink(detailHaushalt(), regeln)).toBe('detailliert');
    const s = new TestSpeicher();
    expect(
      ladeStartzustand(regeln, teilenLink(detailHaushalt(), 'https://x/').slice('https://x/'.length), s).ui.modus,
    ).toBe('detailliert');
  });
});

describe('Schema 2: Ausgabenphasen und Einzeljahre', () => {
  const mitPhasen = () => {
    const h = standardHaushalt(regeln);
    h.ausgaben = {
      ...h.ausgaben,
      lebenshaltung: 55_000,
      phasenBezug: 'alter',
      phasenPerson: 0,
      phasen: [neueAusgabenPhase(63, 67, 85_000), { ...neueAusgabenPhase(68, null, 4_000), einheit: 'monat' }],
      einzeljahre: [neuesAusgabenEinzeljahr(2033, 120_000)],
    };
    return h;
  };

  it('Share-Link: Phasen und Einzeljahre überstehen Kodieren/Dekodieren', () => {
    const h = mitPhasen();
    expect(dekodiere(kodiere(h), regeln)).toEqual(h);
  });

  it('Schema 1 (ohne Phasen) wird mit leeren Listen übernommen', () => {
    const alt = { ...standardHaushalt(regeln), ausgaben: { lebenshaltung: 48_000, faktorAb75: 0.9, faktorAb85: 1.2 } };
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, h: alt }));
    const h = dekodiere(code, regeln);
    expect(h?.ausgaben).toMatchObject({ lebenshaltung: 48_000, faktorAb75: 0.9, phasen: [], einzeljahre: [] });
    expect(h?.ausgaben.phasenBezug).toBe('jahr');
  });

  it('ungültige Phasen/Einzeljahre werden bereinigt', () => {
    const h = normalisiere(
      {
        ausgaben: {
          phasenBezug: 'foo',
          phasenPerson: 5,
          phasen: [{ von: 2030.4, bis: 2020, betrag: -5, einheit: 'woche' }],
          einzeljahre: [
            { jahr: 2031, betrag: 1000 },
            { jahr: 2031, betrag: 2000 },
          ],
        },
      },
      regeln,
    );
    expect(h.ausgaben.phasenBezug).toBe('jahr');
    expect(h.ausgaben.phasenPerson).toBe(0);
    expect(h.ausgaben.phasen[0]).toMatchObject({ von: 2030, bis: 2030, betrag: 0, einheit: 'jahr' });
    expect(h.ausgaben.einzeljahre).toHaveLength(1);
  });

  it('Phasen zählen als Detailwert (Link öffnet die Detailansicht)', () => {
    const h = mitPhasen();
    expect(modusFuerLink(h, regeln)).toBe('detailliert');
  });
});

describe('Schema 8: Darstellung real/nominal', () => {
  it('Standard ist heutige Kaufkraft, auch für ältere Links (Schema 7)', () => {
    expect(standardHaushalt(regeln).darstellung).toBe('real');
    const alt = { ...standardHaushalt(regeln) } as Partial<Haushalt>;
    delete alt.darstellung;
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 7, h: alt }));
    expect(dekodiere(code, regeln)?.darstellung).toBe('real');
  });

  it('übernimmt «nominal» im Link und bereinigt ungültige Werte', () => {
    const h: Haushalt = { ...standardHaushalt(regeln), darstellung: 'nominal' };
    expect(dekodiere(kodiere(h), regeln)?.darstellung).toBe('nominal');
    const kaputt = { ...h, darstellung: 'irgendwas' };
    expect(normalisiere(kaputt, regeln).darstellung).toBe('real');
    // Lokaler Speicher ebenso
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: h, ui: STANDARD_UI });
    expect(ladeLokal(s, regeln)?.haushalt.darstellung).toBe('nominal');
  });
});

describe('Schema 9: Todesfall-Szenario', () => {
  it('Standard ist inaktiv; ältere Links (Schema 8) erhalten es', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(9);
    expect(standardHaushalt(regeln).todesfall?.aktiv).toBe(false);
    const alt = { ...standardHaushalt(regeln) } as Partial<Haushalt>;
    delete alt.todesfall;
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 8, h: alt }));
    const h = dekodiere(code, regeln);
    expect(h?.todesfall?.aktiv).toBe(false);
    expect(h?.todesfall?.ausgabenFaktor).toBe(0.67);
  });

  it('übernimmt gültige Werte in Link und lokalem Speicher, bereinigt ungültige', () => {
    const h: Haushalt = {
      ...standardHaushalt(regeln),
      zivilstand: 'verheiratet',
      personen: [neuePerson(regeln, { name: 'Person A' }), neuePerson(regeln, { name: 'Person B' })],
      todesfall: {
        aktiv: true,
        person: 1,
        modus: 'jahr',
        alter: 70,
        jahr: 2041,
        ausgabenFaktor: 0.8,
        ehejahre: 12,
        kinder: true,
        splitting: true,
      },
    };
    expect(dekodiere(kodiere(h), regeln)?.todesfall).toEqual(h.todesfall);
    const s = new TestSpeicher();
    speichereLokal(s, { haushalt: h, ui: STANDARD_UI });
    expect(ladeLokal(s, regeln)?.haushalt.todesfall).toEqual(h.todesfall);
    const kaputt = normalisiere(
      { ...h, todesfall: { ...h.todesfall, person: 7, ausgabenFaktor: 99, modus: 'x' } },
      regeln,
    );
    expect(kaputt.todesfall?.person).toBe(1);
    expect(kaputt.todesfall?.ausgabenFaktor).toBe(1.5);
    expect(kaputt.todesfall?.modus).toBe('alter');
  });

  it('bei nur einer Person ist das Szenario nie aktiv', () => {
    const h: Haushalt = { ...standardHaushalt(regeln), todesfall: { ...neuesTodesfall(), aktiv: true } };
    expect(normalisiere(h, regeln).todesfall?.aktiv).toBe(false);
  });
});

describe('Schema 10: Sitzkanton je Vorsorgeform', () => {
  it('Version 10; ältere Links erhalten leere Sitze, ungültige Codes werden bereinigt', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(11);
    const h = standardHaushalt(regeln);
    const p0 = h.personen[0] as (typeof h.personen)[number];
    const alt = {
      ...h,
      personen: [
        {
          ...p0,
          wohnsitzAusland: { ...p0.wohnsitzAusland, sitzkantonFz: undefined, sitzkanton3a: undefined },
        },
      ],
    };
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 9, h: alt }));
    const g = dekodiere(code, regeln);
    expect(g?.personen[0]?.wohnsitzAusland.sitzkantonFz).toBe('');
    expect(g?.personen[0]?.wohnsitzAusland.sitzkanton3a).toBe('');
    const n = normalisiere(
      {
        ...h,
        personen: [{ ...p0, wohnsitzAusland: { ...p0.wohnsitzAusland, sitzkantonFz: 'ZG', sitzkanton3a: 'XY' } }],
      },
      regeln,
    );
    expect(n.personen[0]?.wohnsitzAusland.sitzkantonFz).toBe('ZG');
    expect(n.personen[0]?.wohnsitzAusland.sitzkanton3a).toBe('');
  });
});

describe('Schema 11: Staffelung der Kapitalbezüge', () => {
  it('Version 11; ältere Links erhalten die inaktive Staffelung, ungültige Werte werden begrenzt', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(11);
    const h = standardHaushalt(regeln);
    expect(h.staffelung?.aktiv).toBe(false);
    const { staffelung: _weg, ...alt } = h;
    const code = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 10, h: alt }));
    const g = dekodiere(code, regeln);
    expect(g?.staffelung).toEqual({ aktiv: false, jahre: 3, pk: false, fz: true, s3a: true });
    const n = normalisiere({ ...h, staffelung: { aktiv: true, jahre: 99, pk: 'ja', fz: false, s3a: true } }, regeln);
    expect(n.staffelung).toEqual({ aktiv: true, jahre: 10, pk: false, fz: false, s3a: true });
    expect(normalisiere({ ...h, staffelung: { jahre: -4 } }, regeln).staffelung?.jahre).toBe(1);
  });

  it('Kodieren und Dekodieren erhält die Staffelung', () => {
    const h = standardHaushalt(regeln);
    h.staffelung = { aktiv: true, jahre: 4, pk: true, fz: false, s3a: true };
    expect(dekodiere(kodiere(h), regeln)?.staffelung).toEqual(h.staffelung);
  });
});

describe('Standard für Rendite und Teuerung (30.9.2026)', () => {
  it('neue Nutzer: 7 % nominal, 2 % Teuerung, gleiche Annahmen für Schnell und Detailliert', () => {
    const h = standardHaushalt(regeln);
    expect(h.annahmen.renditeNominal).toBe(0.07);
    expect(h.annahmen.inflation).toBe(0.02);
  });

  it('gespeicherte Eingaben (4 % / 1 %) werden beim Laden nicht überschrieben', () => {
    const alt = {
      ...standardHaushalt(regeln),
      annahmen: { ...standardHaushalt(regeln).annahmen, renditeNominal: 0.04, inflation: 0.01 },
    };
    const geladen = dekodiere(kodiere(alt), regeln);
    expect(geladen?.annahmen.renditeNominal).toBe(0.04);
    expect(geladen?.annahmen.inflation).toBe(0.01);
    const ausJson = normalisiere(JSON.parse(JSON.stringify(alt)), regeln);
    expect(ausJson.annahmen.renditeNominal).toBe(0.04);
    expect(ausJson.annahmen.inflation).toBe(0.01);
  });

  it('Stände ohne Annahmen erhalten den neuen Standard', () => {
    const roh = JSON.parse(JSON.stringify(standardHaushalt(regeln)));
    roh.annahmen = undefined;
    const h = normalisiere(roh, regeln);
    expect(h.annahmen.renditeNominal).toBe(0.07);
  });
});

describe('Schema 12: Entnahmestrategie', () => {
  it('Standard ist dynamisch gestaffelt; ohne Feld gilt derselbe Standard', () => {
    expect(SCHEMA_VERSION).toBe(12);
    const h = standardHaushalt(regeln);
    expect(h.entnahme?.art).toBe('gestaffelt');
    const { entnahme: _weg, ...alt } = h;
    expect(normalisiere(alt, regeln).entnahme).toEqual(h.entnahme);
  });

  it('Kodieren und Dekodieren erhält den festen Prozentsatz', () => {
    const h = standardHaushalt(regeln);
    h.entnahme = { art: 'dynamisch', satz: 0.05 };
    expect(dekodiere(kodiere(h), regeln)?.entnahme).toEqual({ art: 'dynamisch', satz: 0.05 });
  });

  it('unbekannte Art fällt auf den Standard zurück, der Satz wird begrenzt', () => {
    expect(normalisiere({ entnahme: { art: 'unbekannt' } }, regeln).entnahme?.art).toBe('gestaffelt');
    expect(normalisiere({ entnahme: { art: 'dynamisch', satz: 9 } }, regeln).entnahme).toEqual({
      art: 'dynamisch',
      satz: 0.2,
    });
  });
});
