import type { ReactNode } from 'react';

export function Karte({
  titel,
  children,
  untertitel,
  hidden,
}: {
  titel: string;
  untertitel?: ReactNode;
  children: ReactNode;
  /** Ausblenden, ohne den Inhalt zu verwerfen (z.B. Lohnfelder bei nicht Erwerbstätigen) */
  hidden?: boolean;
}) {
  return (
    <section className="karte" hidden={hidden}>
      <h2>{titel}</h2>
      {untertitel ? <p className="karte__untertitel">{untertitel}</p> : null}
      {children}
    </section>
  );
}
