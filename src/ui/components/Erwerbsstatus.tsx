/**
 * Erwerbsstatus pro Person (Modi «Schnell» und «Detailliert») und die Felder für nicht
 * erwerbstätige Personen (Familienarbeit): frühere Erwerbstätigkeit, Freizügigkeitsguthaben,
 * Erziehungs-/Betreuungsgutschriften und die geltenden AHV-Annahmen.
 */
import { nichtErwerbAnnahmen } from '../../core/nichtErwerb';
import { istNichtErwerbstaetig } from '../../core/schaetzwerte';
import type { Erwerbsstatus, Person, PersonInfo } from '../../core/typen';
import type { Regeln } from '../../rules';
import { fmtChf } from '../format';
import { BetragFeld, Segmente, ZahlFeld } from './Felder';

type Setzer = (fn: (p: Person) => Person) => void;

export function ErwerbsstatusFeld({ p, set }: { p: Person; set: Setzer }) {
  return (
    <Segmente<Erwerbsstatus>
      label="Erwerbsstatus"
      value={p.erwerbsstatus}
      optionen={[
        { value: 'erwerbstaetig', label: 'Erwerbstätig' },
        { value: 'nichtErwerbstaetig', label: 'Nicht erwerbstätig (z.B. Familienarbeit)' },
      ]}
      onChange={(v) => set((x) => ({ ...x, erwerbsstatus: v }))}
    />
  );
}

interface Props {
  p: Person;
  partner: Person | null;
  verheiratet: boolean;
  set: Setzer;
  regeln: Regeln;
  info: PersonInfo | null;
  /** Geschätzte bzw. übernommene AHV-Rente (CHF/Monat) */
  ahvRente: number;
  ahvGeschaetzt: boolean;
  /** Freizügigkeitsguthaben hier erfassen (Modus «Schnell»; im Detail eigene Karte) */
  mitFreizuegigkeit: boolean;
}

export function NichtErwerbstaetigFelder({
  p,
  partner,
  verheiratet,
  set,
  regeln,
  info,
  ahvRente,
  ahvGeschaetzt,
  mitFreizuegigkeit,
}: Props) {
  if (!istNichtErwerbstaetig(p)) return null;
  const a = nichtErwerbAnnahmen(p, partner, verheiratet, regeln, info);
  const offen =
    p.frueherErwerb.jahre > 0 ||
    p.frueherErwerb.lohn > 0 ||
    p.freizuegigkeit.guthaben > 0 ||
    p.ahvSchaetzhilfe.erziehungsJahre > 0 ||
    p.ahvSchaetzhilfe.betreuungsJahre > 0;
  const setSh = (patch: Partial<Person['ahvSchaetzhilfe']>) =>
    set((x) => ({ ...x, ahvSchaetzhilfe: { ...x.ahvSchaetzhilfe, ...patch } }));
  return (
    <div className="nicht-erwerb">
      <p className="info">
        Nicht erwerbstätig: kein Lohn, keine Einzahlungen in Pensionskasse und Säule 3a (die Felder sind ausgeblendet;
        ein früher eingegebener Lohn bleibt gespeichert).
        {p.pk.guthaben > 0 && p.manuell.pkGuthaben
          ? ` Das früher erfasste PK-Guthaben (${fmtChf(p.pk.guthaben)}) wird nicht verwendet – ohne Anstellung liegt es auf einem Freizügigkeitskonto: bitte dort erfassen.`
          : ''}
      </p>
      <details className="aufklapp" open={offen}>
        <summary>Frühere Erwerbstätigkeit, Freizügigkeit, Kinder (optional)</summary>
        <div className="raster">
          <ZahlFeld
            label="Frühere Erwerbsjahre in der Schweiz"
            einheit="Jahre"
            value={p.frueherErwerb.jahre}
            min={0}
            max={50}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => set((x) => ({ ...x, frueherErwerb: { ...x.frueherErwerb, jahre: Math.round(v) } }))}
          />
          <BetragFeld
            label="Durchschnittslohn damals (heute)"
            value={p.frueherErwerb.lohn}
            min={0}
            max={10_000_000}
            onChange={(v) => set((x) => ({ ...x, frueherErwerb: { ...x.frueherErwerb, lohn: v } }))}
          />
        </div>
        <small className="feld__hinweis">
          Erhöht die eigene AHV-Rente. Ohne Angabe zählt nur das Einkommen des Ehegatten (Splitting).
        </small>
        {mitFreizuegigkeit ? (
          <BetragFeld
            label="Freizügigkeitsguthaben (optional)"
            value={p.freizuegigkeit.guthaben}
            min={0}
            max={100_000_000}
            onChange={(v) => set((x) => ({ ...x, freizuegigkeit: { ...x.freizuegigkeit, guthaben: v } }))}
            hinweis="Pensionskassengeld aus einer früheren Stelle (Freizügigkeitskonto oder -police). Bezug frühestens 5 Jahre vor dem Referenzalter."
          />
        ) : null}
        <div className="raster">
          <ZahlFeld
            label="Jahre mit Kind unter 16"
            einheit="Jahre"
            value={p.ahvSchaetzhilfe.erziehungsJahre}
            min={0}
            max={50}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => setSh({ erziehungsJahre: Math.round(v) })}
            hinweis="Erziehungsgutschriften (mehrere Kinder nicht doppelt: z.B. 2 Kinder im Abstand von 3 Jahren = 19 Jahre)."
          />
          <ZahlFeld
            label="Jahre mit Betreuung von Angehörigen"
            einheit="Jahre"
            value={p.ahvSchaetzhilfe.betreuungsJahre}
            min={0}
            max={50}
            nachkomma={0}
            gruppieren={false}
            onChange={(v) => setSh({ betreuungsJahre: Math.round(v) })}
            hinweis="Betreuungsgutschriften nur für Verwandte mit Hilflosenentschädigung, jährlich anmelden."
          />
        </div>
        <p className="klein">
          Ausländische Beitragsjahre und Renten (z.B. Brasilien): im Modus «Detailliert» unter «Einkommen &amp;
          Vorsorge» → «Ausländische Renten».
        </p>
      </details>
      <div className="ahv-annahmen" role="status">
        <p>
          <strong>AHV als Nichterwerbstätige: diese Annahmen gelten</strong>
        </p>
        <ul className="liste klein">
          {a.punkte.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {a.warnung ? <p className="warnung">{a.warnung}</p> : null}
        <p className="klein">
          AHV-Rente {ahvGeschaetzt ? 'geschätzt' : 'eingegeben'}: <strong>{fmtChf(ahvRente)} pro Monat</strong> (heutige
          Franken, vor Plafonierung). Verbindlich ist nur die Rentenvorausberechnung der Ausgleichskasse.
        </p>
      </div>
    </div>
  );
}
