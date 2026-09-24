import {
  ahvFruehestesBezugsalter,
  ahvMaxVorbezugMonate,
  ahvReferenzalter,
  ahvRentenbeginn,
  inMonaten,
  monatBeiAlter,
} from '../../core/ahv';
import { pruefeFreiwilligeAhv } from '../../core/freiwilligeAhv';
import type { Monat, Nationalitaet, Person, PersonInfo, WohnsitzAusland, ZeitpunktModus } from '../../core/typen';
import { letzterArbeitsmonat, monatBeiAlterMonate, stoppAlterMonate, wegzugIndex } from '../../core/zeitpunkt';
import { MAX_PLANUNGSALTER, neuePerson } from '../../data/defaults';
import { WEGZUGS_LAENDER, wegzugsLand } from '../../data/laender';
import { AuswahlFeld, Schalter, Segmente, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtAlter, fmtChf, fmtMonat, MONATSNAMEN } from '../format';
import { alterMonate, type SchrittProps, setzePerson } from '../kontext';

const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));
const STOPP_MONATE = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i} Mt.` }));
const MODI = [
  { value: 'alter', label: 'Alter' },
  { value: 'datum', label: 'Datum' },
] as const;
const LAENDER = [
  { value: '', label: 'Bitte wählen' },
  ...WEGZUGS_LAENDER.map((l) => ({ value: l.code, label: `${l.name} (${l.euEfta ? 'EU/EFTA' : 'nicht EU/EFTA'})` })),
];
const NATIONALITAETEN = [
  { value: 'CH', label: 'Schweiz' },
  { value: 'EU', label: 'EU/EFTA' },
  { value: 'andere', label: 'andere' },
] as const;

export function Personen({ h, setH, regeln, heute, berechnung }: SchrittProps) {
  const setZivilstand = (z: 'alleinstehend' | 'verheiratet') =>
    setH((alt) => {
      if (z === 'alleinstehend') return { ...alt, zivilstand: z, personen: alt.personen.slice(0, 1) };
      const personen =
        alt.personen.length >= 2
          ? alt.personen
          : [
              ...alt.personen,
              neuePerson(regeln, { name: 'Person 2', geschlecht: alt.personen[0]?.geschlecht === 'w' ? 'm' : 'w' }),
            ];
      return { ...alt, zivilstand: z, personen };
    });

  const juengste = Math.min(...h.personen.map((p) => alterMonate(p, heute)));

  return (
    <>
      <Karte titel="Haushalt">
        <Segmente
          label="Konstellation"
          value={h.zivilstand}
          optionen={[
            { value: 'alleinstehend', label: 'Einzelperson' },
            { value: 'verheiratet', label: 'Ehepaar' },
          ]}
          onChange={setZivilstand}
        />
        <p className="klein">Eingetragene Partnerschaft wird wie eine Ehe behandelt.</p>
        <ZahlFeld
          label="Planungshorizont (Lebensende)"
          einheit="Jahre"
          value={h.planungsalter}
          min={1}
          max={MAX_PLANUNGSALTER}
          nachkomma={0}
          gruppieren={false}
          onChange={(v) => setH((alt) => ({ ...alt, planungsalter: Math.round(v) }))}
          hinweis={`Alter der jüngeren Person, bis zu dem das Vermögen reichen soll. Standard 120, jeder Wert bis ${MAX_PLANUNGSALTER} möglich.`}
          warnung={h.planungsalter * 12 <= juengste ? 'Das Planungsalter liegt unter dem heutigen Alter.' : null}
        />
      </Karte>
      {h.personen.map((p, i) => (
        <PersonKarte
          key={`person-${i === 0 ? 'a' : 'b'}`}
          p={p}
          i={i}
          info={berechnung.wunsch?.personen[i] ?? null}
          props={{ h, setH, regeln, heute }}
        />
      ))}
    </>
  );
}

function PersonKarte({
  p,
  i,
  info,
  props,
}: {
  p: Person;
  i: number;
  info: PersonInfo | null;
  props: Pick<SchrittProps, 'setH' | 'regeln' | 'heute' | 'h'>;
}) {
  const { setH, regeln, heute } = props;
  const set = (fn: (p: Person) => Person) => setzePerson(setH, i, fn);
  const ra = ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv);
  const raM = inMonaten(ra);
  const stoppJ = Math.floor(p.stoppAlter + 1e-9);
  const stoppM = Math.round((p.stoppAlter - stoppJ) * 12);
  const heuteM = alterMonate(p, heute);
  const stoppMonate = stoppAlterMonate(p);
  const letzter = letzterArbeitsmonat(p, stoppMonate);
  const vorbezugMax = ahvMaxVorbezugMonate(p.geburtsjahr, p.geschlecht, regeln.ahv);
  const ahvFrueh = ahvFruehestesBezugsalter(p.geburtsjahr, p.geschlecht, regeln.ahv);

  const setStoppModus = (m: ZeitpunktModus) =>
    set((x) => {
      const monate = stoppAlterMonate(x);
      // Werte gegenseitig übernehmen, damit der Zeitpunkt beim Umschalten gleich bleibt
      return m === 'datum'
        ? { ...x, stoppModus: m, stoppDatum: letzterArbeitsmonat(x, monate) }
        : { ...x, stoppModus: m, stoppAlter: monate / 12 };
    });
  const setStoppDatum = (d: Partial<Monat>) => set((x) => ({ ...x, stoppDatum: { ...x.stoppDatum, ...d } }));

  return (
    <Karte titel={p.name || `Person ${i + 1}`} untertitel={`heute ${fmtAlter(Math.max(0, heuteM))}`}>
      <TextFeld label="Name (optional)" value={p.name} onChange={(v) => set((x) => ({ ...x, name: v }))} />
      <Segmente
        label="Geschlecht"
        value={p.geschlecht}
        optionen={[
          { value: 'w', label: 'Frau' },
          { value: 'm', label: 'Mann' },
        ]}
        onChange={(g) => set((x) => ({ ...x, geschlecht: g }))}
      />
      <div className="raster">
        <ZahlFeld
          label="Geburtsjahr"
          value={p.geburtsjahr}
          min={1920}
          max={heute.jahr}
          nachkomma={0}
          gruppieren={false}
          onChange={(v) => set((x) => ({ ...x, geburtsjahr: Math.round(v) }))}
        />
        <AuswahlFeld
          label="Geburtsmonat"
          value={p.geburtsmonat}
          optionen={MONATE}
          onChange={(v) => set((x) => ({ ...x, geburtsmonat: v }))}
        />
      </div>
      <Segmente
        label="Erwerbsaufgabe (Wunsch) angeben als"
        value={p.stoppModus}
        optionen={MODI}
        onChange={setStoppModus}
      />
      {p.stoppModus === 'alter' ? (
        <div className="raster">
          <ZahlFeld
            label="Erwerbsaufgabe (Wunsch) mit"
            einheit="Jahren"
            value={stoppJ}
            min={0}
            max={80}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => set((x) => ({ ...x, stoppAlter: Math.round(v) + stoppM / 12 }))}
          />
          <AuswahlFeld
            label="und"
            value={stoppM}
            optionen={STOPP_MONATE}
            onChange={(v) => set((x) => ({ ...x, stoppAlter: stoppJ + v / 12 }))}
          />
        </div>
      ) : (
        <div className="raster">
          <AuswahlFeld
            label="Erwerbsaufgabe per Ende (Monat)"
            value={p.stoppDatum.monat}
            optionen={MONATE}
            onChange={(v) => setStoppDatum({ monat: v })}
          />
          <ZahlFeld
            label="Jahr"
            value={p.stoppDatum.jahr}
            min={p.geburtsjahr}
            max={p.geburtsjahr + 80}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => setStoppDatum({ jahr: Math.round(v) })}
          />
        </div>
      )}
      <p className="info" aria-live="polite">
        {p.stoppModus === 'datum' ? (
          <>
            Letzter Arbeitsmonat <strong>{fmtMonat(letzter)}</strong> → Alter bei Erwerbsaufgabe{' '}
            <strong>{fmtAlter(stoppMonate)}</strong>.
          </>
        ) : (
          <>
            Letzter Arbeitsmonat <strong>{fmtMonat(letzter)}</strong>.
          </>
        )}
        {stoppMonate < heuteM ? ' Dieser Zeitpunkt liegt in der Vergangenheit: gerechnet wird ab heute ohne Lohn.' : ''}
      </p>
      <p className="info">
        AHV-Referenzalter <strong>{fmtAlter(raM)}</strong> (erreicht im{' '}
        {fmtMonat(monatBeiAlter(p.geburtsjahr, p.geburtsmonat, raM))}), ordentliche Rente ab{' '}
        <strong>{fmtMonat(ahvRentenbeginn(p.geburtsjahr, p.geburtsmonat, raM))}</strong>.
        <br />
        Frühester AHV-Bezug (Vorbezug): ab <strong>{ahvFrueh} Jahren</strong>, also ab{' '}
        <strong>{fmtMonat(ahvRentenbeginn(p.geburtsjahr, p.geburtsmonat, raM - vorbezugMax))}</strong>{' '}
        <span className="klein">
          (aus Jahrgang und Geschlecht abgeleitet
          {ahvFrueh === regeln.ahv.vorbezug.fruehestesAlterUebergangFrauen
            ? ': Frau der Übergangsgeneration 1961–1969'
            : ''}
          ; gilt nur für die AHV, nicht für die Pensionskasse)
        </span>
      </p>
      <WohnsitzAuslandTeil p={p} set={set} info={info} regeln={regeln} />
    </Karte>
  );
}

function WohnsitzAuslandTeil({
  p,
  set,
  info,
  regeln,
}: {
  p: Person;
  set: (fn: (p: Person) => Person) => void;
  info: PersonInfo | null;
  regeln: SchrittProps['regeln'];
}) {
  const w = p.wohnsitzAusland;
  const setW = (patch: Partial<WohnsitzAusland>) =>
    set((x) => ({ ...x, wohnsitzAusland: { ...x.wohnsitzAusland, ...patch } }));
  const weg = wegzugIndex(p);
  const wegMonat: Monat | null = weg === null ? null : { jahr: Math.floor(weg / 12), monat: (weg % 12) + 1 };
  const wegAlter = weg === null ? null : weg - (p.geburtsjahr * 12 + p.geburtsmonat - 1);
  const land = wegzugsLand(w.land);
  const pruefung = pruefeFreiwilligeAhv(p, regeln);
  const fwJahre = info?.freiwilligeAhvJahre.filter((j) => j.betrag > 0) ?? [];
  const fwTotal = fwJahre.reduce((a, j) => a + j.betrag, 0);
  const alterJ = Math.floor(w.alter + 1e-9);
  const alterM = Math.round((w.alter - alterJ) * 12);

  const setModus = (m: ZeitpunktModus) =>
    set((x) => {
      const wx = x.wohnsitzAusland;
      const idx = wegzugIndex(x);
      if (idx === null) return { ...x, wohnsitzAusland: { ...wx, modus: m } };
      const alter = (idx - (x.geburtsjahr * 12 + x.geburtsmonat - 1)) / 12;
      return {
        ...x,
        wohnsitzAusland:
          m === 'datum'
            ? { ...wx, modus: m, datum: monatBeiAlterMonate(x, Math.round(alter * 12)) }
            : { ...wx, modus: m, alter: Math.max(0, alter) },
      };
    });

  return (
    <details className="aufklapp wegzug" open={w.aktiv}>
      <summary>Wohnsitz im Ausland (Wegzug){w.aktiv && land ? ` · ${land.name}` : ''}</summary>
      <Schalter
        label="Wegzug aus der Schweiz geplant"
        hinweis="Wohnsitz ausserhalb der Schweiz ab einem Alter oder Datum. Beeinflusst AHV-Beiträge und AHV-Rente."
        checked={w.aktiv}
        onChange={(v) => setW({ aktiv: v })}
      />
      {w.aktiv ? (
        <>
          <Segmente label="Wohnsitz im Ausland ab" value={w.modus} optionen={MODI} onChange={setModus} />
          {w.modus === 'alter' ? (
            <div className="raster">
              <ZahlFeld
                label="Wegzug mit"
                einheit="Jahren"
                value={alterJ}
                min={0}
                max={100}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setW({ alter: Math.round(v) + alterM / 12 })}
              />
              <AuswahlFeld
                label="und"
                value={alterM}
                optionen={STOPP_MONATE}
                onChange={(v) => setW({ alter: alterJ + v / 12 })}
              />
            </div>
          ) : (
            <div className="raster">
              <AuswahlFeld
                label="Wohnsitz im Ausland ab (Monat)"
                value={w.datum.monat}
                optionen={MONATE}
                onChange={(v) => setW({ datum: { ...w.datum, monat: v } })}
              />
              <ZahlFeld
                label="Jahr"
                value={w.datum.jahr}
                min={p.geburtsjahr}
                max={p.geburtsjahr + 100}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setW({ datum: { ...w.datum, jahr: Math.round(v) } })}
              />
            </div>
          )}
          {wegMonat && wegAlter !== null ? (
            <p className="klein">
              Wohnsitz im Ausland ab {fmtMonat(wegMonat)} (mit {fmtAlter(Math.max(0, wegAlter))}).
            </p>
          ) : null}
          <AuswahlFeld
            label="Land"
            value={w.land}
            optionen={LAENDER}
            onChange={(v) => setW({ land: v })}
            hinweis="Massgebend für die freiwillige AHV: Wohnsitz in der EU/EFTA oder ausserhalb."
          />
          <Segmente<Nationalitaet>
            label="Staatsangehörigkeit"
            value={w.nationalitaet}
            optionen={NATIONALITAETEN}
            onChange={(v) => setW({ nationalitaet: v })}
          />
          <Schalter
            label="Unmittelbar vor dem Wegzug mind. 5 Jahre ohne Unterbruch in der AHV versichert"
            hinweis="Wohnsitz oder Erwerb in der Schweiz; Beitragszahlung nicht nötig. Zeiten in EU/EFTA-Staaten zählen nicht."
            checked={w.vorherVersichert5Jahre}
            onChange={(v) => setW({ vorherVersichert5Jahre: v })}
          />
          <Schalter
            label="Freiwillige AHV/IV"
            hinweis="Beitritt bei der Schweizerischen Ausgleichskasse SAK innert 1 Jahr nach dem Wegzug. Nur bei Wohnsitz ausserhalb der EU/EFTA."
            checked={w.freiwilligeAhv}
            onChange={(v) => setW({ freiwilligeAhv: v })}
          />
          {w.freiwilligeAhv ? (
            pruefung.berechtigt ? (
              <div className="info">
                <p className="ok">
                  <strong>Voraussetzungen erfüllt</strong> (nach Ihren Angaben).
                </p>
                <ul className="liste">
                  {pruefung.hinweise.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="warnung" role="alert">
                <p>
                  <strong>Freiwillige AHV nicht möglich:</strong>
                </p>
                <ul className="liste">
                  {pruefung.gruende.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p>Gerechnet wird ohne freiwillige AHV (Beitragslücken ab dem Wegzug).</p>
              </div>
            )
          ) : pruefung.vorReferenzalter ? (
            <p className="warnung">
              Ohne freiwillige AHV entstehen ab dem Wegzug bis zum Referenzalter Beitragslücken; die AHV-Rente wird
              entsprechend gekürzt (1/44 je fehlendes Jahr).
            </p>
          ) : null}
          {info && (info.freiwilligeAhvAktiv || info.ahvLueckenAusland > 0) ? (
            <p className="info">
              {info.freiwilligeAhvAktiv ? (
                <>
                  Freiwillige AHV bis zum Referenzalter: total <strong>{fmtChf(fwTotal)}</strong>
                  {fwJahre.length > 0
                    ? ` in ${fwJahre.length} Jahren (Ø ${fmtChf(fwTotal / fwJahre.length)} pro Jahr)`
                    : ''}
                  , in heutigen Franken. Diese Jahre zählen als Beitragsjahre.
                </>
              ) : (
                <>
                  Beitragslücken durch den Auslandwohnsitz: <strong>{info.ahvLueckenAusland} Jahre</strong> → AHV-Rente
                  × {info.ahvLueckenFaktor.toFixed(3)}.
                </>
              )}
            </p>
          ) : null}
        </>
      ) : null}
    </details>
  );
}
