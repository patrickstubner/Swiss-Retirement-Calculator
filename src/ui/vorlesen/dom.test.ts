import { describe, expect, it } from 'vitest';
import { type KnotenLike, positionImBlock, sammleBloecke } from './dom';

/** Minimaler DOM-Ersatz. */
const t = (data: string): KnotenLike => ({ nodeType: 3, nodeName: '#text', childNodes: [], data });
function el(
  name: string,
  attrs: Record<string, string>,
  ...kinder: KnotenLike[]
): KnotenLike & { versteckt?: boolean } {
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    childNodes: kinder,
    getAttribute: (n) => attrs[n] ?? null,
    hasAttribute: (n) => n in attrs,
  };
}

describe('Sammeln vorlesbarer Blöcke', () => {
  it('Überschrift, Absätze, Listen; Reihenfolge bleibt', () => {
    const w = el(
      'section',
      {},
      el('h2', {}, t('Titel')),
      el('p', {}, t('Erster '), el('strong', {}, t('wichtiger')), t(' Satz.')),
      el('ul', {}, el('li', {}, t('Punkt A')), el('li', {}, t('Punkt B'))),
    );
    const b = sammleBloecke(w);
    expect(b.map((x) => x.text)).toEqual(['Titel', 'Erster wichtiger Satz.', 'Punkt A', 'Punkt B']);
  });

  it('Formularfelder, Beschriftungen, Knöpfe, Tabellen und Grafiken werden nie gelesen', () => {
    const w = el(
      'div',
      {},
      el('p', {}, t('Hinweis.')),
      el('label', {}, t('Bruttolohn')),
      el('input', { value: '123456' }),
      el('textarea', {}, t('Geheimnotiz')),
      el('select', {}, el('option', {}, t('Zürich'))),
      el('button', {}, t('Weiter')),
      el('table', {}, el('tr', {}, el('td', {}, t('99999')))),
      el('svg', {}, t('Grafik')),
      el('div', { role: 'img', 'aria-label': 'Chart' }, t('Chart-Text')),
      el('div', { role: 'toolbar' }, t('Leiste')),
      el('div', { contenteditable: 'true' }, t('Editierbar')),
      el('p', {}, t('Ende.')),
    );
    expect(sammleBloecke(w).map((x) => x.text)).toEqual(['Hinweis.', 'Ende.']);
  });

  it('versteckte Elemente werden übersprungen (hidden, aria-hidden, inert, data-vorlesen=aus, unsichtbar)', () => {
    const w = el(
      'div',
      {},
      el('p', { hidden: '' }, t('a')),
      el('p', { 'aria-hidden': 'true' }, t('b')),
      el('p', { inert: '' }, t('c')),
      el('p', { 'data-vorlesen': 'aus' }, t('d')),
      el('p', { id: 'x' }, t('e')),
      el('p', {}, t('sichtbar')),
    );
    const b = sammleBloecke(w, { sichtbar: (k) => k.getAttribute?.('id') !== 'x' });
    expect(b.map((x) => x.text)).toEqual(['sichtbar']);
  });

  it('geschlossenes details: nur die Überschrift; offenes: alles', () => {
    const zu = el('details', {}, el('summary', {}, t('Mehr')), el('p', {}, t('Inhalt')));
    const auf = el('details', { open: '' }, el('summary', {}, t('Mehr')), el('p', {}, t('Inhalt')));
    expect(sammleBloecke(zu).map((x) => x.text)).toEqual(['Mehr']);
    expect(sammleBloecke(auf).map((x) => x.text)).toEqual(['Mehr', 'Inhalt']);
  });

  it('Kennzahlen: Wert und Text getrennt als Blöcke', () => {
    const w = el(
      'div',
      {},
      el(
        'div',
        {},
        el('span', { class: 'kennzahl__wert' }, t('63 J.')),
        el('span', { class: 'kennzahl__text' }, t('Frühestes Alter')),
      ),
    );
    expect(sammleBloecke(w).map((x) => x.text)).toEqual(['63 J.', 'Frühestes Alter']);
  });

  it('leere Blöcke und reiner Leerraum entfallen; Textknoten-Bereiche stimmen', () => {
    const a = t('Erster ');
    const b = t('wichtiger');
    const w = el('div', {}, el('p', {}, t('  ')), el('p', {}, a, el('b', {}, b), t(' Satz.')), el('p', {}));
    const bl = sammleBloecke(w);
    expect(bl.length).toBe(1);
    expect(bl[0]?.segmente.map((s) => [s.start, s.ende])).toEqual([
      [0, 7],
      [7, 16],
      [16, 22],
    ]);
    expect(positionImBlock(bl[0] as NonNullable<(typeof bl)[0]>, 8)?.knoten).toBe(b);
    expect(positionImBlock(bl[0] as NonNullable<(typeof bl)[0]>, 8)?.offset).toBe(1);
    expect(positionImBlock(bl[0] as NonNullable<(typeof bl)[0]>, 7, true)?.knoten).toBe(a);
    expect(positionImBlock(bl[0] as NonNullable<(typeof bl)[0]>, 22, true)?.offset).toBe(6);
    expect(positionImBlock(bl[0] as NonNullable<(typeof bl)[0]>, 999)?.offset).toBe(6);
  });

  it('Schutz: sehr tiefe und sehr grosse Bäume', () => {
    let tief: KnotenLike = t('unten');
    for (let i = 0; i < 1000; i++) tief = el('div', {}, tief);
    expect(() => sammleBloecke(tief)).not.toThrow();
    const gross = el('div', {}, ...Array.from({ length: 2000 }, () => el('p', {}, t('x'.repeat(1000)))));
    const b = sammleBloecke(gross, { maxZeichen: 100_000 });
    expect(b.reduce((s, x) => s + x.text.length, 0)).toBeLessThan(150_000);
  });

  it('kein Text der Ausgeschlossenen im Ergebnis (Fuzz über Namen)', () => {
    for (const n of [
      'input',
      'textarea',
      'select',
      'button',
      'script',
      'style',
      'table',
      'nav',
      'svg',
      'template',
      'label',
    ]) {
      const w = el('div', {}, el(n, {}, t('GEHEIM')), el('p', {}, t('offen')));
      expect(JSON.stringify(sammleBloecke(w).map((x) => x.text)), n).not.toContain('GEHEIM');
    }
  });
});
