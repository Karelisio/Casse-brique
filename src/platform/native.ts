import { Capacitor } from '@capacitor/core';

/** Couche plateforme : web (PWA) ou natif (Capacitor). */
export const isNative = Capacitor.isNativePlatform();

export async function lockPortrait(): Promise<void> {
  try {
    if (isNative) {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: 'portrait' });
      return;
    }
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.('portrait');
  } catch { /* non supporté (iOS Safari, desktop) */ }
}

export async function enterFullscreen(): Promise<void> {
  if (isNative) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (standalone || document.fullscreenElement || !matchMedia('(pointer: coarse)').matches) return;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
  } catch { /* refusé */ }
}

/** Abonne les événements de cycle de vie (arrière-plan, bouton retour Android). */
export function onLifecycle(onPause: () => void, onBack: () => void): void {
  document.addEventListener('visibilitychange', () => { if (document.hidden) onPause(); });
  window.addEventListener('pagehide', onPause);
  window.addEventListener('blur', onPause);
  if (isNative) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('pause', onPause);
      App.addListener('backButton', onBack);
    }).catch(() => {});
  }
}
