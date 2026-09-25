export type MaterialId = 'glass' | 'wood' | 'stone' | 'metal' | 'steel' | 'explosive';

export interface Material {
  id: MaterialId;
  hp: number; // Infinity = indestructible
  score: number;
  fragments: number;
  /** couleurs de base (fragments / particules) */
  base: string;
  light: string;
  dark: string;
  particle: 'shard' | 'splinter' | 'dust' | 'spark';
}

export const MATERIALS: Record<MaterialId, Material> = {
  glass: { id: 'glass', hp: 1, score: 50, fragments: 12, base: '#7cc8f0', light: '#e2f6ff', dark: '#2b6f99', particle: 'shard' },
  wood: { id: 'wood', hp: 2, score: 80, fragments: 8, base: '#b07840', light: '#e0aa6c', dark: '#5e3a1a', particle: 'splinter' },
  stone: { id: 'stone', hp: 3, score: 120, fragments: 9, base: '#8b857c', light: '#bdb6aa', dark: '#4c4740', particle: 'dust' },
  metal: { id: 'metal', hp: 4, score: 180, fragments: 6, base: '#a9b2bd', light: '#f1f4f8', dark: '#5a626d', particle: 'spark' },
  steel: { id: 'steel', hp: Infinity, score: 0, fragments: 0, base: '#4a505a', light: '#9aa3ae', dark: '#23272d', particle: 'spark' },
  explosive: { id: 'explosive', hp: 1, score: 100, fragments: 8, base: '#d8412a', light: '#ffb08a', dark: '#6e160b', particle: 'spark' },
};

/** Caractères de niveau → matériau */
export const CHAR_MAT: Record<string, MaterialId> = {
  G: 'glass', '1': 'glass',
  W: 'wood', '2': 'wood',
  S: 'stone', '3': 'stone',
  M: 'metal',
  X: 'steel',
  E: 'explosive',
};
