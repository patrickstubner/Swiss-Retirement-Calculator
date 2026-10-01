import type { ReactNode } from 'react';

/**
 * Seitlich und senkrecht scrollbarer Tabellenbereich, per Tastatur erreichbar (WCAG 2.1.1, axe «scrollable-region-focusable»):
 * `tabIndex=0` (Pfeiltasten scrollen), `<section>` mit Namen (= Region); der Fokusrahmen kommt aus `.tabelle-scroll:focus-visible`.
 */
export function ScrollTabelle({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollbarer Bereich muss per Tastatur fokussierbar sein
    <section className={`tabelle-scroll${className ? ` ${className}` : ''}`} tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}
