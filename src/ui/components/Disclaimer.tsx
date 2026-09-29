import { DISCLAIMER_ABSAETZE, DISCLAIMER_KURZ } from '../texte';

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
      <h2 id="disclaimer-titel">Wichtiger Hinweis</h2>
      {DISCLAIMER_ABSAETZE.map((t) => (
        <p key={t.slice(0, 24)}>{t}</p>
      ))}
    </section>
  );
}
