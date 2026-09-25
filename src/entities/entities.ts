import { BALL_R, PADDLE_H, PADDLE_W } from '../engine/config';
import { MATERIALS, type Material, type MaterialId } from './materials';

export interface Ball {
  x: number; y: number; px: number; py: number; // position + précédente (interpolation)
  vx: number; vy: number;
  r: number;
  spin: number; // rad/s visuel + effet Magnus
  angle: number; // rotation visuelle
  stuck: boolean; // collée à la raquette
  stuckOffset: number;
  trail: Float32Array; // x,y circulaire
  trailHead: number;
  trailLen: number;
  alive: boolean;
}

export const TRAIL_MAX = 14;

export function createBall(x: number, y: number): Ball {
  return {
    x, y, px: x, py: y, vx: 0, vy: 0, r: BALL_R, spin: 0, angle: 0,
    stuck: false, stuckOffset: 0, trail: new Float32Array(TRAIL_MAX * 2), trailHead: 0, trailLen: 0, alive: true,
  };
}

export function pushTrail(b: Ball): void {
  b.trail[b.trailHead * 2] = b.x;
  b.trail[b.trailHead * 2 + 1] = b.y;
  b.trailHead = (b.trailHead + 1) % TRAIL_MAX;
  if (b.trailLen < TRAIL_MAX) b.trailLen++;
}

export interface Paddle {
  x: number; px: number; // centre
  y: number;
  w: number; targetW: number;
  h: number;
  vx: number;
  targetX: number;
  flash: number;
}

export function createPaddle(x: number, y: number): Paddle {
  return { x, px: x, y, w: PADDLE_W, targetW: PADDLE_W, h: PADDLE_H, vx: 0, targetX: x, flash: 0 };
}

export interface Crack { pts: Float32Array; } // polyligne relative au coin haut-gauche

export interface Brick {
  x: number; y: number; w: number; h: number;
  mat: Material;
  hp: number;
  maxHp: number;
  alive: boolean;
  flash: number;
  cracks: Crack[];
  seed: number;
  fuse: number; // explosif : >0 = détonation en attente
  wobble: number;
}

export function createBrick(x: number, y: number, w: number, h: number, id: MaterialId, seed: number): Brick {
  const mat = MATERIALS[id];
  return { x, y, w, h, mat, hp: mat.hp, maxHp: mat.hp, alive: true, flash: 0, cracks: [], seed, fuse: 0, wobble: 0 };
}

export type PowerUpKind = 'multi' | 'wide' | 'pierce' | 'laser' | 'slow' | 'life';

export interface PowerUp {
  kind: PowerUpKind;
  x: number; y: number; vy: number;
  t: number;
  alive: boolean;
}

export interface Laser { x: number; y: number; alive: boolean; }

export const POWERUP_INFO: Record<PowerUpKind, { label: string; color: string }> = {
  multi: { label: 'Multi-balles', color: '#5ad1ff' },
  wide: { label: 'Raquette large', color: '#6be675' },
  pierce: { label: 'Balle perçante', color: '#ff5a7a' },
  laser: { label: 'Laser', color: '#ff3b3b' },
  slow: { label: 'Ralenti', color: '#b28cff' },
  life: { label: 'Vie +1', color: '#ffd24a' },
};

