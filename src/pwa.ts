// ============================================================
// pwa.ts — Progressive Web App registration helpers
// ============================================================

/** Register the service worker when supported (production + secure contexts). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  // Dev HMR + SW caching fight each other; only enable outside Vite dev.
  if (import.meta.env.DEV) return null;

  try {
    // base is './' so resolve SW relative to the page (GitHub Pages subpaths ok).
    const swUrl = new URL('sw.js', document.baseURI || window.location.href).href;
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: new URL('./', document.baseURI || window.location.href).pathname,
      updateViaCache: 'none',
    });

    // Check for updates when the tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });

    return registration;
  } catch (err) {
    console.warn('[PWA] Service worker registration skipped:', err);
    return null;
  }
}

/** True when the app is running as an installed PWA window. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)');
  if (mq?.matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}
