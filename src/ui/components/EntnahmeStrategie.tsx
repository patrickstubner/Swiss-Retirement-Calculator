/**
 * Eingabe der Entnahmestrategie. Detail: alle Strategien mit ihren Feldern.
 * Schnell (`kompakt`): nur die Auswahl; der Standard ist «Dynamisch gestaffelt».
 */
import {
  ENTNAHME_NAME,
  entnahmeKurztext,
  entnahmeVorlage,
  normalisiereEntnahme,
  standardToepfe,
  tiefereStufe,
  tiefereStufeEntfernen,
} from '../../core/entnahme';
import { filterAnzeigename } from '../../core/text';
import type { Entnahme, EntnahmeTopfVorlage, Haushalt } from '../../core/typen';
import type { Setzer } from '../kontext';
import { AuswahlFeld, TextFeld, ZahlFeld } from './Felder';
import { Karte } from './Karte';

const ARTEN: { value: Entnahme['art']; label: string }[] = [
  { value: 'gestaffelt', label: ENTNAHME_NAME.gestaffelt },
  { value: 'statisch', label: ENTNAHME_NAME.statisch },
  { value: 'dynamisch', label: ENTNAHME_NAME.dynamisch },
  { value: 'annuitaet', label: ENTNAHME_NAME.annuitaet },
  { value: 'toepfe', label: ENTNAHME_NAME.toepfe },
];

function setze(setH: Setzer, entnahme: Entnahme) {
  setH((x) => ({ ...x, entnahme }));
}

export function EntnahmeStrategie({ h, setH, kompakt = false }: { h: Haushalt; setH: Setzer; kompakt?: boolean }) {
  const e = normalisiereEntnahme(h.entnahme);
  const inhalt = (
    <>
      <AuswahlFeld
        label="Strategie"
        value={e.art}
        optionen={ARTEN}
        onChange={(art) => setze(setH, art === e.art ? e : entnahmeVorlage(art))}
        hinweis={entnahmeKurztext(e)}
      />
      {kompakt ? (
        <p className="klein">
          Die Strategie gilt ab dem ersten Jahr ohne Erwerbseinkommen und nur für das freie Vermögen (Bargeld,
          Wertschriften, Sonstiges). AHV, Pensionskasse und weitere Einnahmen bleiben bestehen. Einstellungen der
          einzelnen Strategien finden Sie im Modus «Detailliert».
        </p>
      ) : (
        <StrategieFelder e={e} setH={setH} />
      )}
    </>
  );
  if (kompakt) return inhalt;
  return (
    <Karte
      titel="Entnahmestrategie"
      untertitel="Wie das freie Vermögen im Ruhestand aufgebraucht wird. Pensionskasse, Freizügigkeit und Säule 3a folgen weiterhin den Bezugsregeln."
    >
      {inhalt}
    </Karte>
  );
}

function StrategieFelder({ e, setH }: { e: Entnahme; setH: Setzer }) {
  if (e.art === 'gestaffelt') return <Gestaffelt e={e} setH={setH} />;
  if (e.art === 'statisch') return <Statisch e={e} setH={setH} />;
  if (e.art === 'dynamisch') return <Dynamisch e={e} setH={setH} />;
  if (e.art === 'annuitaet') return <Annuitaet e={e} setH={setH} />;
  return <Toepfe e={e} setH={setH} />;
}

function Gestaffelt({ e, setH }: { e: Extract<Entnahme, { art: 'gestaffelt' }>; setH: Setzer }) {
  const boden = Math.min(...e.stufen.map((s) => s.abWachstum));
  return (
    <>
      <p className="klein">
        Massgebend ist das reale Wachstum des freien Vermögens im Vorjahr (nach Kosten und Teuerung, ohne
        Kapitalbezüge). Genau auf einer Schwelle gilt der höhere Satz. Unter 2 % bleibt der Satz im Standard bei 3,5 %,
        auch bei starken Verlusten. Im ersten Simulationsjahr fehlt das Vorjahr, gerechnet wird mit 0 %.
      </p>
      {e.stufen.map((s, i) => {
        const darunter = i === e.stufen.length - 1 && s.abWachstum <= boden;
        return (
          <div className="raster" key={s.id}>
            {darunter ? (
              <p className="klein">Unter der tiefsten Schwelle</p>
            ) : (
              <ZahlFeld
                label="Ab Wachstum"
                prozent
                nachkomma={1}
                value={s.abWachstum}
                min={-1}
                max={1}
                onChange={(v) =>
                  setze(setH, {
                    ...e,
                    stufen: e.stufen.map((x, j) => (j === i ? { ...x, abWachstum: v } : x)),
                  })
                }
              />
            )}
            <ZahlFeld
              label="Entnahmesatz"
              prozent
              nachkomma={1}
              value={s.satz}
              min={0}
              max={0.2}
              onChange={(v) =>
                setze(setH, {
                  ...e,
                  stufen: e.stufen.map((x, j) => (j === i ? { ...x, satz: v } : x)),
                })
              }
            />
          </div>
        );
      })}
      <div className="knopf-reihe">
        {e.stufen.length < 8 ? (
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => setze(setH, { ...e, stufen: tiefereStufe(e.stufen) })}
          >
            {e.stufen.some((s) => Math.abs(s.abWachstum + 0.04) < 1e-9)
              ? 'Weitere tiefere Stufe'
              : 'Stufe für Verluste unter −4 % ergänzen'}
          </button>
        ) : null}
        {e.stufen.length > 4 ? (
          <button
            type="button"
            className="knopf knopf--sekundaer"
            onClick={() => setze(setH, { ...e, stufen: tiefereStufeEntfernen(e.stufen) })}
          >
            Tiefere Stufe entfernen
          </button>
        ) : null}
      </div>
      <p className="klein">
        Optional und nicht im Standard: eine tiefere Stufe, zum Beispiel 3 % bei Wachstum unter −4 %. Genau −4 % bleibt
        dann bei 3,5 %; 3 % gilt nur streng darunter.
      </p>
    </>
  );
}

function Statisch({ e, setH }: { e: Extract<Entnahme, { art: 'statisch' }>; setH: Setzer }) {
  return (
    <>
      <AuswahlFeld
        label="Was die Höhe bestimmt"
        value={e.quelle}
        optionen={[
          { value: 'ausgaben', label: 'Erfasste Ausgaben' },
          { value: 'satz', label: 'Anfangssatz vom freien Vermögen' },
        ]}
        onChange={(quelle) => setze(setH, { ...e, quelle })}
      />
      {e.quelle === 'ausgaben' ? (
        <p className="klein">
          Die Lebenshaltungskosten oben bleiben real gleich (nominal mit der Teuerung). AHV, Pensionskasse und weitere
          Einnahmen verkleinern die Lücke, die aus dem freien Vermögen gedeckt wird. Im Ergebnis sehen Sie, welchem
          Anfangssatz das im ersten Jahr ohne Erwerbseinkommen entspricht.
        </p>
      ) : (
        <>
          <ZahlFeld
            label="Anfangssatz"
            prozent
            nachkomma={1}
            value={e.satz}
            min={0}
            max={0.2}
            onChange={(satz) => setze(setH, { ...e, satz })}
            hinweis="Im ersten Jahr ohne Erwerbseinkommen: Satz mal freies Vermögen nach Rendite und Kapitalbezügen. Danach bleibt dieser Betrag real gleich. Die Einnahmen kommen zusätzlich dazu und senken den Satz nicht."
          />
          <p className="klein">
            Die erfassten Lebenshaltungskosten dienen dann als Vergleich. Liegt die Strategie-Entnahme darunter, sinkt
            die ausgegebene Lebenshaltung; liegt sie darüber, steigt sie.
          </p>
        </>
      )}
    </>
  );
}

function Dynamisch({ e, setH }: { e: Extract<Entnahme, { art: 'dynamisch' }>; setH: Setzer }) {
  return (
    <ZahlFeld
      label="Entnahmesatz pro Jahr"
      prozent
      nachkomma={1}
      value={e.satz}
      min={0}
      max={0.2}
      onChange={(satz) => setze(setH, { ...e, satz })}
      hinweis="Prozent des freien Vermögens nach der Rendite dieses Jahres. AHV, Pensionskasse und weitere Einnahmen kommen zusätzlich dazu; sie senken den Satz nicht."
    />
  );
}

function Annuitaet({ e, setH }: { e: Extract<Entnahme, { art: 'annuitaet' }>; setH: Setzer }) {
  return (
    <>
      <p className="klein">
        Jedes Jahr neu aus dem verbleibenden freien Kapital, den Jahren bis zum Planungsalter und der erwarteten realen
        Rendite. Trifft die Rendite jedes Jahr genau zu, ist das freie Vermögen am Planungshorizont etwa null. Das ist
        eine Annahme, keine Garantie. Standard der Studie: Aktien 5 % real, Obligationen 1 % real, gewichtet mit Ihrem
        Aktienanteil.
      </p>
      <AuswahlFeld
        label="Erwartete Realrendite"
        value={e.renditeModus}
        optionen={[
          { value: 'gewichtet', label: 'Gewichtet nach Aktienanteil' },
          { value: 'satz', label: 'Ein Satz' },
        ]}
        onChange={(renditeModus) => setze(setH, { ...e, renditeModus })}
      />
      {e.renditeModus === 'gewichtet' ? (
        <div className="raster">
          <ZahlFeld
            label="Aktien real"
            prozent
            nachkomma={1}
            value={e.aktienReal}
            min={-0.2}
            max={0.2}
            onChange={(aktienReal) => setze(setH, { ...e, aktienReal })}
          />
          <ZahlFeld
            label="Obligationen real"
            prozent
            nachkomma={1}
            value={e.obligationenReal}
            min={-0.2}
            max={0.2}
            onChange={(obligationenReal) => setze(setH, { ...e, obligationenReal })}
          />
        </div>
      ) : (
        <ZahlFeld
          label="Realrendite"
          prozent
          nachkomma={1}
          value={e.satz}
          min={-0.2}
          max={0.2}
          onChange={(satz) => setze(setH, { ...e, satz })}
        />
      )}
    </>
  );
}

function Toepfe({ e, setH }: { e: Extract<Entnahme, { art: 'toepfe' }>; setH: Setzer }) {
  const setTopf = (i: number, patch: Partial<EntnahmeTopfVorlage>) =>
    setze(setH, { ...e, toepfe: e.toepfe.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <>
      <p className="klein">
        Zu Beginn der Entnahmephase deckt «Cash / Geldmarkt» den Startpuffer (Standard 1 Jahr Nettobedarf: Ausgaben und
        Steuern abzüglich AHV, Pensionskasse und weiterer Einnahmen). Über die Aufbaujahre wächst dieses Ziel (Standard
        auf 2 Jahre in 4 Jahren). Ausgegeben wird zuerst aus dem Cash-Topf, dann aus «ETF und Obligationen», dann aus
        «Aktien». Einmal jährlich wird der Puffer aus den anderen Töpfen aufgefüllt, zuerst aus dem mittleren Topf.
        Liegt die reale Jahresrendite eines Topfes unter der Schwelle, wird er dafür nicht verkauft. Für die Ausgaben
        wird er verkauft, wenn der Puffer nicht reicht. Mittel- bis langfristige Obligationen gehören in den mittleren
        Topf, nicht in den Puffer. Der Puffer ist kurzfristig und liquide (Konto, Geldmarktfonds, sehr kurze
        Staatsanleihen).
      </p>
      <AuswahlFeld
        label="Anzahl Töpfe"
        value={e.anzahl}
        optionen={[
          { value: 2, label: '2: Aktien und ETF sowie Cash / Geldmarkt' },
          { value: 3, label: '3: Aktien, ETF und Obligationen, Cash / Geldmarkt' },
        ]}
        onChange={(anzahl) =>
          setze(setH, {
            ...e,
            anzahl,
            toepfe: standardToepfe(anzahl),
          })
        }
        hinweis={
          e.anzahl === 2
            ? 'Bei zwei Töpfen liegen Aktien, ETF und Obligationen zusammen im Risikotopf. Der Puffer bleibt Cash / Geldmarkt.'
            : 'Der mittlere Topf nimmt breite ETF und mittel- bis langfristige Obligationen auf.'
        }
      />
      <div className="raster">
        <ZahlFeld
          label="Puffer zu Beginn"
          einheit="Monate"
          nachkomma={0}
          value={e.pufferMonateStart}
          min={0}
          max={240}
          onChange={(pufferMonateStart) => setze(setH, { ...e, pufferMonateStart })}
        />
        <ZahlFeld
          label="Zielpuffer"
          einheit="Monate"
          nachkomma={0}
          value={e.pufferMonateZiel}
          min={0}
          max={240}
          onChange={(pufferMonateZiel) => setze(setH, { ...e, pufferMonateZiel })}
        />
        <ZahlFeld
          label="Aufbau"
          einheit="Jahre"
          nachkomma={0}
          value={e.aufbauJahre}
          min={0}
          max={40}
          onChange={(aufbauJahre) => setze(setH, { ...e, aufbauJahre })}
          hinweis="Nach so vielen Entnahmejahren ist der Zielpuffer erreicht."
        />
        <ZahlFeld
          label="Keine Auffüllung unter"
          prozent
          nachkomma={0}
          value={e.keinVerkaufUnter}
          min={-0.8}
          max={0.5}
          onChange={(keinVerkaufUnter) => setze(setH, { ...e, keinVerkaufUnter })}
          hinweis="Reale Jahresrendite des Topfes. Darunter wird er nicht verkauft, um den Puffer aufzufüllen."
        />
      </div>
      {e.toepfe.map((t, i) => (
        <div className="raster" key={t.rolle}>
          <TextFeld
            label="Bezeichnung"
            maxLength={40}
            value={t.label}
            onChange={(label) => setTopf(i, { label: filterAnzeigename(label, 40) })}
          />
          {t.rolle === 'cash' ? (
            <p className="klein">
              Die Grösse setzt die Pufferregel, nicht ein fester Anteil. Realrendite standardmässig 0,5 % (Spanne etwa 0
              bis 1 %).
            </p>
          ) : (
            <ZahlFeld
              label="Anteil am Rest nach dem Puffer"
              prozent
              nachkomma={0}
              value={t.anteil}
              min={0}
              max={1}
              onChange={(anteil) => setTopf(i, { anteil })}
              hinweis="Die Anteile der Risikotöpfe werden auf 100 % umgerechnet."
            />
          )}
          <ZahlFeld
            label="Erwartete Realrendite"
            prozent
            nachkomma={1}
            value={t.renditeReal}
            min={-0.5}
            max={0.2}
            onChange={(renditeReal) => setTopf(i, { renditeReal })}
          />
        </div>
      ))}
    </>
  );
}
