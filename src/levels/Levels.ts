import data from './levels.json';
import { COLS } from '../engine/config';
import { CHAR_MAT, type MaterialId } from '../entities/materials';
import { generateLevel } from './procedural';

export interface LevelDef {
  name: string;
  /** grille [ligne][colonne] ; null = vide */
  grid: (MaterialId | null)[][];
  procedural: boolean;
}

export const HANDMADE_COUNT = data.levels.length;

export function parseRows(rows: string[]): (MaterialId | null)[][] {
  return rows.map((row, i) => {
    if (row.length !== COLS) throw new Error(`Ligne ${i} : ${row.length} colonnes au lieu de ${COLS}`);
    return [...row].map((ch) => {
      if (ch === '.' || ch === ' ') return null;
      const m = CHAR_MAT[ch];
      if (!m) throw new Error(`Caractère inconnu « ${ch} »`);
      return m;
    });
  });
}

/** index 0-based ; au-delà des niveaux JSON → génération procédurale */
export function getLevel(index: number): LevelDef {
  if (index < HANDMADE_COUNT) {
    const l = data.levels[index];
    return { name: l.name, grid: parseRows(l.rows), procedural: false };
  }
  return { name: `Secteur ${index + 1}`, grid: generateLevel(index), procedural: true };
}

/** vrai s'il reste au moins une brique destructible */
export function hasDestructible(grid: (MaterialId | null)[][]): boolean {
  return grid.some((r) => r.some((c) => c !== null && c !== 'steel'));
}
