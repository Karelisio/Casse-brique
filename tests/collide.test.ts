import { describe, expect, it } from 'vitest';
import { makeHit, sweepCircleAABB } from '../src/physics/collide';

describe('sweepCircleAABB (CCD)', () => {
  const h = makeHit();
  it('détecte une face touchée par le haut', () => {
    expect(sweepCircleAABB(50, 0, 0, 100, 5, 0, 50, 100, 60, h)).toBe(true);
    expect(h.t).toBeCloseTo(0.45);
    expect(h.ny).toBe(-1);
  });
  it('pas de tunneling à très haute vitesse', () => {
    // brique fine de 2px traversée en un seul pas de 10 000 px
    expect(sweepCircleAABB(50, -5000, 0, 10000, 3, 0, 0, 100, 2, h)).toBe(true);
    expect(h.ny).toBe(-1);
  });
  it('gère les coins (normale diagonale)', () => {
    expect(sweepCircleAABB(-10, -10, 20, 20, 3, 0, 0, 10, 10, h)).toBe(true);
    expect(h.nx).toBeLessThan(0);
    expect(h.ny).toBeLessThan(0);
    expect(Math.hypot(h.nx, h.ny)).toBeCloseTo(1);
  });
  it('ignore un coin frôlé', () => {
    expect(sweepCircleAABB(-10, -5, 0, 20, 3, 0, 0, 10, 10, h)).toBe(false);
  });
  it('dépénètre si déjà en chevauchement et se rapproche', () => {
    expect(sweepCircleAABB(50, 48, 0, 5, 5, 0, 50, 100, 60, h)).toBe(true);
    expect(h.t).toBe(0);
    expect(h.ny).toBe(-1);
  });
  it('ignore si en chevauchement mais s’éloigne', () => {
    expect(sweepCircleAABB(50, 48, 0, -5, 5, 0, 50, 100, 60, h)).toBe(false);
  });
  it('rate quand le trajet passe à côté', () => {
    expect(sweepCircleAABB(200, 0, 0, 100, 5, 0, 50, 100, 60, h)).toBe(false);
  });
});
