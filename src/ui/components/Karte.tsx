import type { ReactNode } from 'react';
import { VorlesenKnoepfe } from '../vorlesen/Vorlesen';

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
      <div className="karte__kopf">
        <h2>{titel}</h2>
        <VorlesenKnoepfe titel={titel} />
      </div>
      {untertitel ? <p className="karte__untertitel">{untertitel}</p> : null}
      {children}
    </section>
  );
}
