import { COLS } from '../engine/config';
import type { MaterialId } from '../entities/materials';
import { mulberry32 } from './rng';

/**
 * Génère un niveau symétrique, déterministe pour un index donné.
 * La difficulté (lignes, matériaux durs, acier) augmente avec l'index.
 */
export function generateLevel(index: number): (MaterialId | null)[][] {
  const rnd = mulberry32(0x9e3779b1 ^ (index * 2654435761));
  const d = Math.min(1, (index - 9) / 25); // 0 → 1
  const rows = 6 + Math.min(5, Math.floor(index / 5)) + (rnd() < 0.5 ? 0 : 1);
  const half = COLS / 2;
  const weights: [MaterialId, number][] = [
    ['glass', 3 - 2 * d],
    ['wood', 2.5],
    ['stone', 1 + 2 * d],
    ['metal', 0.3 + 1.7 * d],
    ['explosive', 0.35],
    ['steel', 0.1 + 0.4 * d],
  ];
  const total = weights.reduce((s, w) => s + w[1], 0);
  const pick = (): MaterialId => {
    let r = rnd() * total;
    for (const [m, w] of weights) if ((r -= w) <= 0) return m;
    return 'glass';
  };
  // motif : densité par ligne + trous
  const pattern = Math.floor(rnd() * 4);
  const grid: (MaterialId | null)[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: (MaterialId | null)[] = new Array(COLS).fill(null);
    const rowMat = rnd() < 0.55 ? pick() : null; // lignes homogènes
    for (let x = 0; x < half; x++) {
      let filled = true;
      if (pattern === 1) filled = (x + y) % 2 === 0 || rnd() < 0.3;
      else if (pattern === 2) filled = x >= Math.abs(half - 1 - y) - 1 || rnd() < 0.15;
      else if (pattern === 3) filled = y % 3 !== 2 || x === 0;
      else filled = rnd() < 0.85;
      if (!filled) continue;
      let m = rowMat ?? pick();
      // l'acier ne bloque jamais une ligne entière
      if (m === 'steel' && (y === rows - 1 || x % 2 === 1)) m = 'stone';
      row[x] = m;
      row[COLS - 1 - x] = m;
    }
    grid.push(row);
  }
  // garantit au moins 70 % de briques destructibles
  let destructible = 0, count = 0;
  for (const r of grid) for (const c of r) if (c) { count++; if (c !== 'steel') destructible++; }
  if (count === 0 || destructible < 12) {
    grid.push(new Array(COLS).fill('glass'));
    grid.push(new Array(COLS).fill('wood'));
  }
  return grid;
}
