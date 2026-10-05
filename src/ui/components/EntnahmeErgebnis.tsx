/**
 * Zeigt die aktive Entnahmestrategie und, je nach Strategie, die jährliche Entnahme oder die Töpfe.
 */
import { ENTNAHME_NAME, entnahmeKurztext, normalisiereEntnahme } from '../../core/entnahme';
import type { Entnahme, SimulationsErgebnis } from '../../core/typen';
import { fmtChf, fmtProzent } from '../format';
import { Karte } from './Karte';
import { ScrollTabelle } from './ScrollTabelle';

export function EntnahmeErgebnis({
  strategie,
  e,
  refIdx,
}: {
  strategie: Entnahme | undefined;
  e: SimulationsErgebnis;
  refIdx: number;
}) {
  const s = normalisiereEntnahme(strategie);
  const jahre = e.zeilen.filter((z) => z.lohn <= 0);
  const erstes = jahre.find((z) => z.entnahmeBasis > 1);
  const toepfeLabels = jahre.find((z) => z.entnahmeToepfe && z.entnahmeToepfe.length > 0)?.entnahmeToepfe ?? [];
  const satzStrategie =
    s.art === 'gestaffelt' ||
    s.art === 'dynamisch' ||
    s.art === 'annuitaet' ||
    (s.art === 'statisch' && s.quelle === 'satz');
  return (
    <Karte titel="Entnahmestrategie" untertitel={ENTNAHME_NAME[s.art]}>
      <p>{entnahmeKurztext(s)}</p>
      {s.art === 'statisch' && s.quelle === 'ausgaben' && erstes ? (
        <p className="klein">
          Im ersten Jahr ohne Erwerbseinkommen mit freiem Vermögen ({erstes.jahr}) entspricht die Entnahme{' '}
          {fmtChf(erstes.entnahmeFrei)}
          {erstes.entnahmeBasis > 1
            ? `, das sind ${fmtProzent(erstes.entnahmeFrei / erstes.entnahmeBasis, 1)} des freien Vermögens`
            : ''}
          . AHV, Pensionskasse und weitere Einnahmen sind darin nicht enthalten; sie haben die Lücke bereits
          verkleinert.
        </p>
      ) : null}
      {jahre.length === 0 ? (
        <p className="klein">Im gezeigten Verlauf gibt es noch kein Jahr ohne Erwerbseinkommen.</p>
      ) : satzStrategie ? (
        <ScrollTabelle label="Jährliche Entnahme aus dem freien Vermögen">
          <table className="jahrestabelle">
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Alter</th>
                {s.art === 'gestaffelt' ? <th>Wachstum Vorjahr</th> : null}
                <th>Satz</th>
                <th>Entnahme</th>
              </tr>
            </thead>
            <tbody>
              {jahre.map((z) => (
                <tr key={z.jahr}>
                  <td>{z.jahr}</td>
                  <td>{z.alter[refIdx] ?? ''}</td>
                  {s.art === 'gestaffelt' ? (
                    <td>{z.entnahmeWachstum === null ? '0 % (kein Vorjahr)' : fmtProzent(z.entnahmeWachstum, 1)}</td>
                  ) : null}
                  <td>{z.entnahmeSatz === null ? '–' : fmtProzent(z.entnahmeSatz, 1)}</td>
                  <td>{fmtChf(z.entnahmeFrei)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTabelle>
      ) : s.art === 'toepfe' ? (
        <ScrollTabelle label="Töpfe und Entnahme pro Jahr">
          <table className="jahrestabelle">
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Alter</th>
                <th>Entnahme</th>
                {toepfeLabels.map((t) => (
                  <th key={t.label}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jahre.map((z) => (
                <tr key={z.jahr}>
                  <td>{z.jahr}</td>
                  <td>{z.alter[refIdx] ?? ''}</td>
                  <td>{fmtChf(z.entnahmeFrei)}</td>
                  {toepfeLabels.map((t, i) => (
                    <td key={t.label}>{fmtChf(z.entnahmeToepfe?.[i]?.wert ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTabelle>
      ) : null}
    </Karte>
  );
}
