import type { ReactNode } from 'react';

export function Karte({ titel, children, untertitel }: { titel: string; untertitel?: ReactNode; children: ReactNode }) {
  return (
    <section className="karte">
      <h2>{titel}</h2>
      {untertitel ? <p className="karte__untertitel">{untertitel}</p> : null}
      {children}
    </section>
  );
}
