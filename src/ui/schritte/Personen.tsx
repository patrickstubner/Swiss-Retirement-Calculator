import {
  ahvFruehestesBezugsalter,
  ahvMaxVorbezugMonate,
  ahvReferenzalter,
  ahvRentenbeginn,
  inMonaten,
  monatBeiAlter,
} from '../../core/ahv';
import { pruefeFreiwilligeAhv } from '../../core/freiwilligeAhv';
import type { Nationalitaet, Person, PersonInfo, WohnsitzAusland } from '../../core/typen';
import { MAX_PLANUNGSALTER, neuePerson } from '../../data/defaults';
import { wegzugsLand } from '../../data/laender';
import { Schalter, Segmente, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { ErwerbsaufgabeFelder, GeburtFelder, InChSeitFeld } from '../components/PersonBasis';
import { WegzugZeitpunktFelder } from '../components/Wegzug';
import { fmtAlter, fmtChf, fmtMonat } from '../format';
import { alterMonate, type SchrittProps, setzePerson } from '../kontext';

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
  const heuteM = alterMonate(p, heute);
  const vorbezugMax = ahvMaxVorbezugMonate(p.geburtsjahr, p.geschlecht, regeln.ahv);
  const ahvFrueh = ahvFruehestesBezugsalter(p.geburtsjahr, p.geschlecht, regeln.ahv);

  return (
    <Karte titel={p.name || `Person ${i + 1}`} untertitel={`heute ${fmtAlter(Math.max(0, heuteM))}`}>
      <TextFeld label="Name (optional)" value={p.name} onChange={(v) => set((x) => ({ ...x, name: v }))} />
      <GeburtFelder p={p} set={set} heute={heute} />
      <InChSeitFeld p={p} set={set} heute={heute} regeln={regeln} />
      <ErwerbsaufgabeFelder p={p} set={set} heute={heute} />
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
  const land = wegzugsLand(w.land);
  const pruefung = pruefeFreiwilligeAhv(p, regeln);
  const fwJahre = info?.freiwilligeAhvJahre.filter((j) => j.betrag > 0) ?? [];
  const fwTotal = fwJahre.reduce((a, j) => a + j.betrag, 0);

  return (
    <details className="aufklapp wegzug" open={w.aktiv}>
      <summary>Wohnsitz im Ausland (Wegzug){w.aktiv && land ? ` · ${land.name}` : ''}</summary>
      <WegzugZeitpunktFelder p={p} set={set} />
      {w.aktiv ? (
        <>
          <p className="klein">
            Barauszahlung von Pensionskasse, Freizügigkeit und 3a beim Wegzug: im Schritt «Einkommen &amp; Vorsorge»
            (Karte «Wegzug ins Ausland», gleiche Angaben).
          </p>
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
