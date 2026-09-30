import { DISCLAIMER_ABSAETZE, DISCLAIMER_KURZ } from '../texte';
import { VorlesenKnoepfe } from '../vorlesen/Vorlesen';

export function DisclaimerBanner() {
  return (
    <details className="disclaimer">
      <summary>
        <strong>Wichtiger Hinweis:</strong> {DISCLAIMER_KURZ} <span className="disclaimer__mehr">Mehr</span>
      </summary>
      {DISCLAIMER_ABSAETZE.map((t) => (
        <p key={t.slice(0, 24)}>{t}</p>
      ))}
    </details>
  );
}

export function DisclaimerVoll() {
  return (
    <section className="karte karte--hinweis" aria-labelledby="disclaimer-titel">
      <div className="karte__kopf">
        <h2 id="disclaimer-titel">Wichtiger Hinweis</h2>
        <VorlesenKnoepfe titel="Wichtiger Hinweis" />
      </div>
      {DISCLAIMER_ABSAETZE.map((t) => (
        <p key={t.slice(0, 24)}>{t}</p>
      ))}
    </section>
  );
}
