export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  quality: Quality;
}

export interface Progress {
  best: number;
  unlocked: number; // index 0-based du plus haut niveau débloqué
}

const KEY_SETTINGS = 'cb.settings.v1';
const KEY_PROGRESS = 'cb.progress.v1';

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...def, ...JSON.parse(raw) } : def;
  } catch {
    return def;
  }
}
function save(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

export const settings: Settings = load<Settings>(KEY_SETTINGS, { sound: true, vibration: true, quality: 'auto' });
export const progress: Progress = load<Progress>(KEY_PROGRESS, { best: 0, unlocked: 0 });

export function saveSettings(): void { save(KEY_SETTINGS, settings); }
export function saveProgress(): void { save(KEY_PROGRESS, progress); }
