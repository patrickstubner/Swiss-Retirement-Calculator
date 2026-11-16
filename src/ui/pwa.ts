/**
 * Homescreen-App: registriert dist/sw.js (nur im Produktions-Build, nur über https oder localhost).
 * Relativer Pfad, damit Scope und Datei unter /Swiss-Retirement-Calculator/ bleiben.
 * Fehler werden ignoriert: der Rechner funktioniert auch ohne Service Worker gleich.
 */
export function registriereServiceWorker(
  nav: Navigator | undefined = globalThis.navigator,
  produktion = import.meta.env.PROD,
): boolean {
  if (!produktion || !nav || !('serviceWorker' in nav)) return false;
  const registriere = () => {
    nav.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
  };
  // Erst nach dem Laden, damit der erste Seitenaufbau nicht mit dem Vorab-Laden konkurriert.
  if (typeof document === 'undefined' || document.readyState === 'complete') registriere();
  else globalThis.addEventListener('load', registriere, { once: true });
  return true;
}
