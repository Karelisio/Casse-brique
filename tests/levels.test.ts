import { describe, expect, it } from 'vitest';
import { getLevel, hasDestructible, HANDMADE_COUNT } from '../src/levels/Levels';
import { generateLevel } from '../src/levels/procedural';
import { COLS } from '../src/engine/config';

describe('niveaux', () => {
  it('au moins 10 niveaux JSON valides', () => {
    expect(HANDMADE_COUNT).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < HANDMADE_COUNT; i++) {
      const l = getLevel(i);
      expect(l.procedural).toBe(false);
      expect(hasDestructible(l.grid)).toBe(true);
      for (const r of l.grid) expect(r.length).toBe(COLS);
    }
  });
  it('génération procédurale déterministe, symétrique et jouable', () => {
    for (let i = HANDMADE_COUNT; i < HANDMADE_COUNT + 60; i++) {
      const a = generateLevel(i), b = generateLevel(i);
      expect(a).toEqual(b);
      expect(hasDestructible(a)).toBe(true);
      for (const r of a) for (let x = 0; x < COLS; x++) expect(r[x]).toBe(r[COLS - 1 - x]);
    }
    expect(getLevel(HANDMADE_COUNT).procedural).toBe(true);
  });
});
