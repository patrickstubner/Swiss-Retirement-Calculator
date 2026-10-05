import { DISCLAIMER_KURZ, disclaimerAbsaetze } from '../texte';
import { VorlesenKnoepfe } from '../vorlesen/Vorlesen';

export function DisclaimerBanner({ jahr }: { jahr: number }) {
  const absaetze = disclaimerAbsaetze(jahr);
  return (
    <details className="disclaimer">
      <summary>
        <strong>Wichtiger Hinweis:</strong> {DISCLAIMER_KURZ} <span className="disclaimer__mehr">Mehr</span>
      </summary>
      {absaetze.map((t) => (
        <p key={t.slice(0, 24)}>{t}</p>
      ))}
    </details>
  );
}

export function DisclaimerVoll({ jahr }: { jahr: number }) {
  const absaetze = disclaimerAbsaetze(jahr);
  return (
    <section className="karte karte--hinweis" aria-labelledby="disclaimer-titel">
      <div className="karte__kopf">
        <h2 id="disclaimer-titel">Wichtiger Hinweis</h2>
        <VorlesenKnoepfe titel="Wichtiger Hinweis" />
      </div>
      {absaetze.map((t) => (
        <p key={t.slice(0, 24)}>{t}</p>
      ))}
    </section>
  );
}
