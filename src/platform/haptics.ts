import { settings } from '../engine/Settings';
import { isNative } from './native';

type HapticsMod = typeof import('@capacitor/haptics');
let native: HapticsMod | null = null;
if (isNative) import('@capacitor/haptics').then((m) => (native = m)).catch(() => {});

let last = 0;

/** Vibration courte ; limitée en fréquence pour ne pas saturer le moteur. */
export function vibrate(ms: number | number[], force = false): void {
  if (!settings.vibration) return;
  const now = performance.now();
  if (!force && now - last < 45) return;
  last = now;
  if (native) {
    const d = Array.isArray(ms) ? ms[0] : ms;
    const style = d >= 40 ? native.ImpactStyle.Heavy : d >= 18 ? native.ImpactStyle.Medium : native.ImpactStyle.Light;
    native.Haptics.impact({ style }).catch(() => {});
    return;
  }
  try { navigator.vibrate?.(ms); } catch { /* non supporté */ }
}
