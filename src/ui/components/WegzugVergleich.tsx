/**
 * Karte «Wegzug-Vergleich PK/3a»: Bezug bei Wohnsitz in der Schweiz gegen Wegzug in ein Nicht-EU/EFTA-Land und
 * (wählbar) ein EU/EFTA-Land wie Portugal, mit Quellensteuer am Sitz der Einrichtung und optionaler DBA-Rückerstattung.
 */
import { useMemo, useState } from 'react';
import { inDarstellung } from '../../core/nominal';
import type { Haushalt, Monat } from '../../core/typen';
import { standardEinstellung, type WegzugEinstellung, wegzugVergleich } from '../../core/wegzugVergleich';
import { KANTONE } from '../../data/kantone';
import { WEGZUGS_LAENDER, wegzugsLand } from '../../data/laender';
import type { Regeln } from '../../rules';
import { chfKurz, darstellungVon, inFranken } from '../darstellung';
import { fmtChf } from '../format';
import { HINWEIS_OBLIGATORIUM, WEGZUG_QUELLEN, zeigeObligatoriumHinweis } from '../wegzugVergleich';
import { AuswahlFeld, Schalter, ZahlFeld } from './Felder';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

const sitzOptionen = (leer: string) => [
  { value: '', label: leer },
  ...KANTONE.map((k) => ({ value: k.code, label: `${k.name} (${k.code})` })),
];

const LAND_OPTIONEN = (mitLeer: boolean) => [
  ...(mitLeer ? [{ value: '', label: 'Kein zweites Ziel' }] : []),
  ...WEGZUGS_LAENDER.map((l) => ({ value: l.code, label: `${l.name} (${l.euEfta ? 'EU/EFTA' : 'nicht EU/EFTA'})` })),
];

interface Props {
  h: Haushalt;
  effH: Haushalt;
  regeln: Regeln;
  heute: Monat;
  namen: string[];
}

export function WegzugVergleichKarte({ h, effH, regeln, heute, namen }: Props) {
  const [aktiv, setAktiv] = useState(false);
  const [person, setPerson] = useState(0);
  const [ein, setEin] = useState<WegzugEinstellung | null>(null);
  const dar = darstellungVon(h);
  const e: WegzugEinstellung = ein && ein.person === person ? ein : standardEinstellung(effH, regeln, person);
  const set = (patch: Partial<WegzugEinstellung>) => setEin({ ...e, ...patch });
  const wohnkanton = h.steuern.kanton;

  const faelle = useMemo(() => {
    if (!aktiv) return null;
    const roh = wegzugVergleich(effH, regeln, heute, e);
    return roh.map((f) => ({ ...f, sim: inDarstellung(f.sim, dar) }));
  }, [aktiv, effH, regeln, heute, e, dar]);

  const alterJ = Math.floor(e.wegzugAlterMonate / 12);
  const alterM = e.wegzugAlterMonate % 12;
  const zeile = (label: string, wert: (f: NonNullable<typeof faelle>[number]) => string, fett = false) => (
    <tr>
      <th scope="row">{label}</th>
      {faelle?.map((f) => (
        <td key={f.id}>{fett ? <strong>{wert(f)}</strong> : wert(f)}</td>
      ))}
    </tr>
  );
  const ziel = (f: NonNullable<typeof faelle>[number]) => wegzugsLand(f.land);

  return (
    <Karte
      titel="Wegzug-Vergleich: Pensionskasse und 3a"
      untertitel="Bezug bei Wohnsitz in der Schweiz gegen Bezug nach dem Wegzug ins Ausland – Kapital, Quellensteuer und Wirkung auf den Plan"
    >
      <Schalter
        label="Wegzug-Vergleich rechnen"
        hinweis="Rechnet Ihren Plan dreimal: Wohnsitz bleibt in der Schweiz, Wegzug in ein Nicht-EU/EFTA-Land, Wegzug in ein zweites Land (Standard Spanien, EU)."
        checked={aktiv}
        onChange={setAktiv}
      />
      {aktiv ? (
        <>
          {h.personen.length > 1 ? (
            <AuswahlFeld<number>
              label="Wer zieht weg?"
              value={person}
              optionen={h.personen.map((_, i) => ({ value: i, label: namen[i] ?? `Person ${i + 1}` }))}
              onChange={setPerson}
            />
          ) : null}
          <div className="raster">
            <ZahlFeld
              label="Alter beim Wegzug"
              value={alterJ}
              min={0}
              max={120}
              nachkomma={0}
              einheit="Jahre"
              onChange={(v) => set({ wegzugAlterMonate: Math.max(0, Math.round(v)) * 12 + alterM })}
            />
            <ZahlFeld
              label="und Monate"
              value={alterM}
              min={0}
              max={11}
              nachkomma={0}
              einheit="Monate"
              onChange={(v) => set({ wegzugAlterMonate: alterJ * 12 + Math.min(11, Math.max(0, Math.round(v))) })}
            />
          </div>
          <div className="raster">
            <AuswahlFeld
              label="Ziel B (Standard: Thailand, nicht EU/EFTA)"
              value={e.ziele[0] ?? 'TH'}
              optionen={LAND_OPTIONEN(false)}
              onChange={(v) => set({ ziele: [v, e.ziele[1] ?? ''] })}
            />
            <AuswahlFeld
              label="Ziel C (Standard: Spanien, EU)"
              value={e.ziele[1] ?? ''}
              optionen={LAND_OPTIONEN(true)}
              onChange={(v) => set({ ziele: [e.ziele[0] ?? 'TH', v] })}
            />
          </div>
          <div className="raster">
            <AuswahlFeld
              label="Sitzkanton der Pensionskasse"
              value={e.sitzPk}
              optionen={sitzOptionen(`Wie Wohnkanton${wohnkanton ? ` (${wohnkanton})` : ''}`)}
              onChange={(v) => set({ sitzPk: v })}
              hinweis="Nur für Bezüge nach dem Wegzug (Quellensteuer). Bei Wohnsitz in der Schweiz zählt der Wohnkanton, nicht der Sitz."
            />
            <AuswahlFeld
              label="Sitzkanton der Freizügigkeitseinrichtung"
              value={e.sitzFz}
              optionen={sitzOptionen('Wie Pensionskasse')}
              onChange={(v) => set({ sitzFz: v })}
            />
            <AuswahlFeld
              label="Sitzkanton des 3a-Anbieters"
              value={e.sitz3a}
              optionen={sitzOptionen('Wie Pensionskasse')}
              onChange={(v) => set({ sitz3a: v })}
            />
          </div>
          <Schalter
            label="EU/EFTA: im neuen Land nicht obligatorisch versichert"
            hinweis="Nur wenn Sie dort für Alter, Tod und Invalidität nicht obligatorisch versichert sind, entfällt die Sperre des Obligatoriums (Art. 25f FZG); Liechtenstein: bei Wohnsitz dort immer gesperrt. Nachweis über den Sicherheitsfonds BVG."
            checked={e.nichtObligatorischVersichert}
            onChange={(v) => set({ nichtObligatorischVersichert: v })}
          />
          <Schalter
            label="Quellensteuer gemäss DBA zurückfordern (nur wo ESTV 2-217 «ja» sagt)"
            hinweis="Nur wenn der Wohnsitzstaat das Besteuerungsrecht hat: Antrag innert 3 Jahren mit Bestätigung der dortigen Steuerbehörde. Dann zahlen Sie stattdessen die Steuer im Zielland. Brasilien: definitiv, keine Rückforderung. Ohne Schalter bleibt die volle Quellensteuer."
            checked={e.rueckforderung}
            onChange={(v) => set({ rueckforderung: v })}
          />
          {e.rueckforderung ? (
            <ZahlFeld
              label="Steuersatz auf zurückgefordertes Vorsorgekapital im Zielland"
              value={e.satzKapitalZielland ?? 0}
              prozent
              nachkomma={1}
              min={0}
              max={0.6}
              onChange={(v) => set({ satzKapitalZielland: v })}
              hinweis="Der Satz ist je Land OFFEN (ausser Italien 5 %). Ohne Eingabe wird keine Rückforderung gerechnet."
            />
          ) : null}

          {faelle ? (
            <>
              <ScrollTabelle label="Wegzug im Vergleich (Tabelle, scrollbar)">
                <table className="vergleich-tabelle wegzug-tabelle">
                  <caption>
                    {namen[person] ?? 'Person'}: Bezug bei Wohnsitz in der Schweiz gegen Wegzug mit {alterJ} J. {alterM}{' '}
                    Mt. ({inFranken(dar)})
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col"> </th>
                      {faelle.map((f) => (
                        <th key={f.id} scope="col">
                          {f.titel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zeile('Pensionskasse als Kapital', (f) => fmtChf(f.kapital.pkFrei))}
                    {zeile('Obligatorium gesperrt (Freizügigkeitskonto)', (f) =>
                      f.land === '' ? '–' : fmtChf(f.kapital.pkGesperrt),
                    )}
                    {zeile('PK-Rente pro Jahr', (f) => (f.pkRenteJahr > 0 ? fmtChf(f.pkRenteJahr) : '–'))}
                    {zeile('Freizügigkeit als Kapital', (f) => fmtChf(f.kapital.freizuegigkeit))}
                    {zeile('Säule 3a als Kapital', (f) => fmtChf(f.kapital.saeule3a))}
                    {zeile('Kapital total (brutto)', (f) => fmtChf(f.kapital.brutto), true)}
                    {zeile('Quellensteuer (bleibt in der Schweiz)', (f) =>
                      f.land === '' ? '–' : fmtChf(f.steuern.quellensteuer),
                    )}
                    {zeile('Quellensteuer zurückgefordert', (f) =>
                      f.land === ''
                        ? '–'
                        : f.steuern.quellensteuerZurueck > 0
                          ? fmtChf(f.steuern.quellensteuerZurueck)
                          : 'nein',
                    )}
                    {zeile('Steuer im Zielland auf das Kapital', (f) =>
                      f.land === ''
                        ? '–'
                        : f.steuern.ziellandKapital > 0
                          ? fmtChf(f.steuern.ziellandKapital)
                          : 'OFFEN / nicht gerechnet',
                    )}
                    {zeile('Steuern auf Kapitalbezüge (Plan)', (f) => fmtChf(f.steuern.kapitalHaushalt))}
                    {zeile(
                      'Netto-Kapital nach Steuer',
                      (f) => (f.nettoKapital === null ? 'nur bei einer Person' : fmtChf(f.nettoKapital)),
                      true,
                    )}
                    {zeile(
                      `Vermögen am Ende (${chfKurz(dar)})`,
                      (f) => fmtChf(f.sim.zeilen.at(-1)?.vermoegen ?? 0),
                      true,
                    )}
                    {zeile('Geld reicht bis Alter', (f) =>
                      f.reichtBis === null ? 'bis Planungsende' : String(f.reichtBis),
                    )}
                  </tbody>
                </table>
              </ScrollTabelle>

              {faelle.some((f) => f.status && f.status.fall !== 'barauszahlung') ? (
                <p className="warnung">
                  Bei diesem Wegzugsalter wird nicht bar ausbezahlt: Wer die Pensionskasse am oder nach dem Bezugsalter
                  verlässt, erhält die Altersleistung nach Reglement (Art. 2 Abs. 1bis FZG). Wählen Sie einen früheren
                  Wegzug, um die Barauszahlung zu vergleichen.
                </p>
              ) : null}

              {zeigeObligatoriumHinweis(faelle) ? (
                <p className="info" role="status">
                  <strong>{HINWEIS_OBLIGATORIUM}</strong> In der EU/EFTA bleibt das BVG-Altersguthaben gesperrt, solange
                  Sie dort obligatorisch versichert sind (Art. 25f FZG); es wird dann erst als Freizügigkeitsleistung
                  frühestens 5 Jahre vor dem Referenzalter ausbezahlt. Bei Wohnsitz in der Schweiz gibt es nur das
                  Überobligatorium als Kapital (oder Rente nach Reglement); das Obligatorium bleibt Rente bzw. auf dem
                  Freizügigkeitskonto.
                </p>
              ) : null}

              <ul className="liste klein">
                <li>
                  <strong>Quellensteuer:</strong> Wer bei der Auszahlung im Ausland wohnt, wird an der Quelle besteuert:
                  Bund (QStV) plus Tarif des Kantons, in dem die Einrichtung ihren Sitz hat (
                  {e.sitzPk || wohnkanton || 'Wohnkanton'}); der Abzug erfolgt immer (ESTV 2-217, Ziff. 1.2 und 4.1). Ob
                  es zurückgeht, hängt vom Abkommen ab:{' '}
                  {faelle
                    .filter((f) => f.land)
                    .map((f) => {
                      const l = ziel(f);
                      return `${f.landName}: ${l?.pkKapitalCh ? `${l.pkKapitalCh} (ESTV 2-217)` : 'Land unbekannt (OFFEN)'}`;
                    })
                    .join('; ')}
                  .
                </li>
                <li>
                  <strong>3a:</strong> Bei endgültigem Verlassen der Schweiz kann das 3a-Guthaben vorzeitig bezogen
                  werden (Art. 3 Abs. 2 lit. d BVV 3), auch bei Umzug in die EU/EFTA (BSV, Mitteilungen Nr. 96, Rz 567).
                  Die Quellensteuer auf 3a-Kapital wird nur in Ländern zurückerstattet, bei denen ESTV 2-217 «ja» sagt
                  (Thailand, Brasilien, VAE, Philippinen: nein). Verheiratete brauchen die schriftliche Zustimmung des
                  Ehegatten (Art. 5 Abs. 2 FZG).
                </li>
                <li>
                  <strong>Im Plan enthalten:</strong> Schweizer Quellensteuer, AHV-Folgen des Wegzugs (Beitragslücken,
                  freiwillige AHV nur, wenn im Wegzug-Bereich gewählt) und die Steuern des Ziellands nach dem
                  Ländermodell. <strong>Nicht gerechnet:</strong> Steuer im Zielland auf das Vorsorgekapital ohne
                  Rückforderung mit Satz (OFFEN für die meisten Länder), Exit- oder Wegzugssteuern des Ziellands,
                  Krankenkasse
                </li>
              </ul>
            </>
          ) : null}
          <p className="klein">
            Modellrechnung, keine Steuer- oder Rechtsberatung. Klären Sie Barauszahlung, Sperre und Rückerstattung vor
            dem Wegzug mit Ihrer Vorsorgeeinrichtung, der Steuerbehörde am Sitz der Einrichtung und dem Sicherheitsfonds
            BVG.
          </p>
          <details>
            <summary>Quellen und Stand</summary>
            <ul className="liste klein">
              {WEGZUG_QUELLEN.map((q) => (
                <li key={q.url}>
                  {q.text}:{' '}
                  <a href={q.url} target="_blank" rel="noreferrer">
                    {q.url}
                  </a>{' '}
                  (Stand {q.stand})
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </Karte>
  );
}
