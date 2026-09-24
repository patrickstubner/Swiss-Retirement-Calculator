import { ahvReferenzalter, ahvRentenbeginn, inMonaten, monatBeiAlter } from '../../core/ahv';
import type { Person } from '../../core/typen';
import { MAX_PLANUNGSALTER, neuePerson } from '../../data/defaults';
import { AuswahlFeld, Segmente, TextFeld, ZahlFeld } from '../components/Felder';
import { Karte } from '../components/Karte';
import { fmtAlter, fmtMonat, MONATSNAMEN } from '../format';
import { alterMonate, type SchrittProps, setzePerson } from '../kontext';

const MONATE = MONATSNAMEN.map((n, i) => ({ value: i + 1, label: n }));
const STOPP_MONATE = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i} Mt.` }));

export function Personen({ h, setH, regeln, heute }: SchrittProps) {
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
        <PersonKarte key={`person-${i === 0 ? 'a' : 'b'}`} p={p} i={i} props={{ h, setH, regeln, heute }} />
      ))}
    </>
  );
}

function PersonKarte({
  p,
  i,
  props,
}: {
  p: Person;
  i: number;
  props: Pick<SchrittProps, 'setH' | 'regeln' | 'heute' | 'h'>;
}) {
  const { setH, regeln, heute } = props;
  const set = (fn: (p: Person) => Person) => setzePerson(setH, i, fn);
  const ra = ahvReferenzalter(p.geburtsjahr, p.geschlecht, regeln.ahv);
  const raM = inMonaten(ra);
  const stoppJ = Math.floor(p.stoppAlter + 1e-9);
  const stoppM = Math.round((p.stoppAlter - stoppJ) * 12);
  const heuteM = alterMonate(p, heute);

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
      <p className="info">
        AHV-Referenzalter <strong>{fmtAlter(raM)}</strong> (erreicht im{' '}
        {fmtMonat(monatBeiAlter(p.geburtsjahr, p.geburtsmonat, raM))}), ordentliche Rente ab{' '}
        <strong>{fmtMonat(ahvRentenbeginn(p.geburtsjahr, p.geburtsmonat, raM))}</strong>.
      </p>
    </Karte>
  );
}
