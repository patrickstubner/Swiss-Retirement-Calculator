/**
 * Lebenshaltung im Detailmodus: Grundbetrag, Phasen (von–bis) und Einzeljahr-Abweichungen.
 * Alle Beträge in heutigen Franken; Anzeige der Hochrechnung mit der erwarteten Teuerung.
 */
import { lebenshaltungImJahr, nominalImJahr, proJahr } from '../../core/ausgaben';
import type { AusgabenPhase, BetragEinheit, Haushalt, Monat } from '../../core/typen';
import { neueAusgabenPhase, neuesAusgabenEinzeljahr } from '../../data/defaults';
import { fmtChf, fmtProzent, fmtZahl } from '../format';
import type { Setzer } from '../kontext';
import { AuswahlFeld, BetragFeld, ZahlFeld } from './Felder';

const EINHEITEN: { value: BetragEinheit; label: string }[] = [
  { value: 'jahr', label: 'pro Jahr' },
  { value: 'monat', label: 'pro Monat' },
];

interface Props {
  h: Haushalt;
  setH: Setzer;
  heute: Monat;
  /** Referenzperson (jüngere) für Planungsende und Faktoren ab 75/85 */
  refIdx: number;
}

/** «Beträge in heutigen Franken …» mit Beispiel der Hochrechnung. */
export function HeutigeFrankenHinweis({
  betrag,
  heute,
  inflation,
}: {
  betrag: number;
  heute: Monat;
  inflation: number;
}) {
  const b = betrag > 0 ? betrag : 60_000;
  const jahr = heute.jahr + 10;
  return (
    <p className="info heutige-franken" role="note">
      <strong>Beträge in heutigen Franken</strong> (Kaufkraft heute). Die App rechnet sie mit der erwarteten Teuerung
      von {fmtProzent(inflation)} pro Jahr (Schritt «Annahmen») auf das jeweilige Jahr hoch: {fmtZahl(b)} heute
      entsprechen {jahr} ca. {fmtZahl(nominalImJahr(b, jahr, heute.jahr, inflation))}.
    </p>
  );
}

export function AusgabenPhasen({ h, setH, heute, refIdx }: Props) {
  const a = h.ausgaben;
  const inflation = h.annahmen.inflation;
  const ref = h.personen[refIdx] ?? h.personen[0];
  const endJahr = ref ? ref.geburtsjahr + h.planungsalter : heute.jahr + 40;
  const altersBezug = a.phasenBezug === 'alter';
  const bezugsPerson = h.personen[a.phasenPerson] ?? h.personen[0];
  const pName = (i: number) => h.personen[i]?.name || `Person ${i + 1}`;
  const setA = (fn: (x: Haushalt['ausgaben']) => Haushalt['ausgaben']) =>
    setH((x) => ({ ...x, ausgaben: fn(x.ausgaben) }));
  const setPhase = (id: string, patch: Partial<AusgabenPhase>) =>
    setA((x) => ({ ...x, phasen: x.phasen.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  /** Kalenderjahr zu einem Phasenwert (Alter → Jahr) */
  const zuJahr = (w: number) => (altersBezug && bezugsPerson ? bezugsPerson.geburtsjahr + w : w);
  const zuWert = (jahr: number) => (altersBezug && bezugsPerson ? jahr - bezugsPerson.geburtsjahr : jahr);
  const bezugWert = altersBezug ? `p${a.phasenPerson}` : 'jahr';
  const bezugOptionen = [
    { value: 'jahr', label: 'Kalenderjahr' },
    ...h.personen.map((_, i) => ({ value: `p${i}`, label: `Alter von ${pName(i)}` })),
  ];
  const setBezug = (v: string) =>
    setA((x) => {
      const neuAlter = v !== 'jahr';
      const person = neuAlter ? Number(v.slice(1)) : x.phasenPerson;
      const alt = x.phasenBezug === 'alter' ? h.personen[x.phasenPerson] : undefined;
      const neu = neuAlter ? h.personen[person] : undefined;
      // Phasen auf denselben Kalenderjahren halten
      const umrechnen = (w: number) => {
        const jahr = alt ? alt.geburtsjahr + w : w;
        return neu ? jahr - neu.geburtsjahr : jahr;
      };
      return {
        ...x,
        phasenBezug: neuAlter ? 'alter' : 'jahr',
        phasenPerson: person,
        phasen: x.phasen.map((p) => ({ ...p, von: umrechnen(p.von), bis: p.bis === null ? null : umrechnen(p.bis) })),
      };
    });
  const neuePhase = () =>
    setA((x) => {
      const letzte = x.phasen.at(-1);
      const von = letzte ? (letzte.bis === null ? zuWert(heute.jahr) : letzte.bis + 1) : zuWert(heute.jahr);
      return { ...x, phasen: [...x.phasen, neueAusgabenPhase(von, von + 4, Math.round(x.lebenshaltung))] };
    });
  const neuesEinzeljahr = () =>
    setA((x) => {
      let jahr = heute.jahr;
      while (x.einzeljahre.some((e) => e.jahr === jahr)) jahr++;
      const basis = lebenshaltungImJahr(x, jahr, h.personen, ref ? jahr - ref.geburtsjahr : 0).betrag;
      return { ...x, einzeljahre: [...x.einzeljahre, neuesAusgabenEinzeljahr(jahr, Math.round(basis))] };
    });
  const wertLabel = altersBezug ? 'Alter' : 'Jahr';
  const einheitWert = altersBezug ? 'Jahren' : undefined;

  const vorschau = [];
  for (let j = heute.jahr; j <= Math.min(endJahr, heute.jahr + 60); j++) {
    const r = lebenshaltungImJahr(a, j, h.personen, ref ? j - ref.geburtsjahr : 0);
    vorschau.push({ jahr: j, ...r, nominal: nominalImJahr(r.betrag, j, heute.jahr, inflation) });
  }

  return (
    <div className="ausgaben-phasen">
      <h3>Phasen (optional)</h3>
      <p className="klein">
        Z.B. die ersten Jahre nach der Pensionierung mehr (Reisen), danach weniger. Beträge in heutigen Franken. Jahre
        ohne Phase: Grundbetrag oben (mit den Faktoren ab 75/85). Bei Überschneidung gilt die obere Phase.
      </p>
      {h.personen.length > 1 || a.phasen.length > 0 ? (
        <AuswahlFeld
          label="Phasen beziehen sich auf"
          value={bezugWert}
          optionen={bezugOptionen}
          onChange={setBezug}
          hinweis={
            altersBezug
              ? 'Alter, das die Person im jeweiligen Kalenderjahr erreicht.'
              : 'Kalenderjahre, unabhängig vom Alter.'
          }
        />
      ) : null}
      {a.phasen.map((ph, k) => {
        const vonJahr = zuJahr(ph.von);
        const bisJahr = ph.bis === null ? endJahr : zuJahr(ph.bis);
        const jahre = Math.max(0, bisJahr - vonJahr + 1);
        const betragJahr = proJahr(ph.betrag, ph.einheit);
        const frueher = a.phasen
          .slice(0, k)
          .findIndex(
            (q) => q.von <= (ph.bis ?? Number.POSITIVE_INFINITY) && ph.von <= (q.bis ?? Number.POSITIVE_INFINITY),
          );
        const beispielJahr = Math.max(vonJahr, heute.jahr);
        return (
          <div key={ph.id} className="unterkarte unterkarte--ausgabe phase">
            <p className="phase__titel">
              <strong>Phase {k + 1}</strong>{' '}
              <span className="klein">
                {altersBezug
                  ? `${pName(a.phasenPerson)} ${ph.von}–${ph.bis ?? 'Lebensende'} = ${vonJahr}–${ph.bis === null ? 'Ende' : bisJahr}`
                  : `${vonJahr}–${ph.bis === null ? 'Ende' : bisJahr}`}{' '}
                ({jahre} {jahre === 1 ? 'Jahr' : 'Jahre'})
              </span>
            </p>
            <div className="raster">
              <ZahlFeld
                label={`Von ${wertLabel}`}
                einheit={einheitWert}
                value={ph.von}
                min={0}
                max={9999}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setPhase(ph.id, { von: Math.round(v) })}
              />
              <ZahlFeld
                label={`Bis ${wertLabel} (inkl.)`}
                einheit={einheitWert}
                value={ph.bis ?? 0}
                min={0}
                max={9999}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) => setPhase(ph.id, { bis: v > 0 ? Math.round(v) : null })}
                hinweis="Leer = bis Lebensende"
                warnung={ph.bis !== null && ph.bis < ph.von ? '«Bis» liegt vor «Von».' : null}
              />
            </div>
            <div className="raster">
              <BetragFeld
                label="Betrag (heute)"
                value={ph.betrag}
                min={0}
                max={100_000_000}
                onChange={(v) => setPhase(ph.id, { betrag: v })}
              />
              <AuswahlFeld
                label="Einheit"
                value={ph.einheit}
                optionen={EINHEITEN}
                onChange={(v) => setPhase(ph.id, { einheit: v })}
              />
            </div>
            <p className="klein" aria-live="polite">
              = {fmtChf(betragJahr)} pro Jahr heute; {beispielJahr} ca.{' '}
              {fmtChf(nominalImJahr(betragJahr, beispielJahr, heute.jahr, inflation))} (mit Teuerung).
            </p>
            {frueher >= 0 ? (
              <p className="warnung">
                Überschneidet sich mit Phase {frueher + 1} – in den gemeinsamen Jahren gilt Phase {frueher + 1}.
              </p>
            ) : null}
            <button
              type="button"
              className="knopf knopf--sekundaer"
              onClick={() => setA((x) => ({ ...x, phasen: x.phasen.filter((y) => y.id !== ph.id) }))}
            >
              Phase entfernen
            </button>
          </div>
        );
      })}
      <button type="button" className="knopf knopf--sekundaer" onClick={neuePhase}>
        + Phase hinzufügen
      </button>

      <h3>Einzelne Jahre anpassen (optional)</h3>
      <p className="klein">
        Ersetzt die Lebenshaltung eines Kalenderjahres (z.B. Umzug, grosse Reise). Betrag in heutigen Franken.
      </p>
      {a.einzeljahre.map((e) => {
        const doppelt = a.einzeljahre.filter((x) => x.jahr === e.jahr).length > 1;
        const bj = proJahr(e.betrag, e.einheit);
        return (
          <div key={e.id} className="unterkarte einzeljahr">
            <div className="raster">
              <ZahlFeld
                label="Kalenderjahr"
                value={e.jahr}
                min={1900}
                max={9999}
                nachkomma={0}
                gruppieren={false}
                onChange={(v) =>
                  setA((x) => ({
                    ...x,
                    einzeljahre: x.einzeljahre.map((y) => (y.id === e.id ? { ...y, jahr: Math.round(v) } : y)),
                  }))
                }
                warnung={doppelt ? 'Dieses Jahr ist mehrfach erfasst – es gilt der erste Eintrag.' : null}
              />
              <BetragFeld
                label="Betrag (heute)"
                value={e.betrag}
                min={0}
                max={100_000_000}
                onChange={(v) =>
                  setA((x) => ({
                    ...x,
                    einzeljahre: x.einzeljahre.map((y) => (y.id === e.id ? { ...y, betrag: v } : y)),
                  }))
                }
              />
            </div>
            <AuswahlFeld
              label="Einheit"
              value={e.einheit}
              optionen={EINHEITEN}
              onChange={(v) =>
                setA((x) => ({
                  ...x,
                  einzeljahre: x.einzeljahre.map((y) => (y.id === e.id ? { ...y, einheit: v } : y)),
                }))
              }
            />
            <p className="klein">
              = {fmtChf(bj)} im Jahr {e.jahr} (heute); nominal ca.{' '}
              {fmtChf(nominalImJahr(bj, e.jahr, heute.jahr, inflation))}.
            </p>
            <button
              type="button"
              className="knopf knopf--sekundaer"
              onClick={() => setA((x) => ({ ...x, einzeljahre: x.einzeljahre.filter((y) => y.id !== e.id) }))}
            >
              Entfernen
            </button>
          </div>
        );
      })}
      <button type="button" className="knopf knopf--sekundaer" onClick={neuesEinzeljahr}>
        + Einzeljahr hinzufügen
      </button>

      <details className="aufklapp ausgaben-vorschau">
        <summary>Vorschau pro Jahr (heute und hochgerechnet)</summary>
        <div className="tabelle-scroll">
          <table>
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Heute</th>
                <th>Nominal</th>
                <th>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {vorschau.map((z) => (
                <tr key={z.jahr} className={z.quelle !== 'grund' ? 'hervor' : undefined}>
                  <td>{z.jahr}</td>
                  <td>{fmtZahl(z.betrag)}</td>
                  <td>{fmtZahl(z.nominal)}</td>
                  <td>
                    {z.quelle === 'einzeljahr'
                      ? 'Einzeljahr'
                      : z.quelle === 'phase'
                        ? `Phase ${z.index + 1}`
                        : 'Grundbetrag'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="klein">
          «Heute» = Kaufkraft heute (so wird gerechnet); «Nominal» = auf jenes Jahr hochgerechnet mit{' '}
          {fmtProzent(inflation)} Teuerung pro Jahr. Das Ergebnis zeigt heutige Franken; das erste Jahr zählt nur ab dem
          aktuellen Monat.
        </p>
      </details>
    </div>
  );
}
