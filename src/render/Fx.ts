import { GRAVITY, WORLD_W } from '../engine/config';
import type { Brick } from '../entities/entities';
import type { Material } from '../entities/materials';

/** Types de particules */
export const enum PK { Spark, Shard, Dust, Smoke, Ring, Ember }

export interface Particle {
  kind: PK;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  size: number; rot: number; vr: number;
  grav: number; drag: number;
  color: string;
}

export interface Fragment {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number;
  life: number; max: number;
  n: number; pts: Float32Array; // sommets locaux (max 6)
  mat: Material;
  shade: number; // variation de teinte
}

/** Pools d'objets pré-alloués : zéro allocation pendant le jeu. */
export class Fx {
  particles: Particle[] = [];
  np = 0;
  fragments: Fragment[] = [];
  nf = 0;
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  flash = 0; // flash plein écran (explosions)
  maxParticles = 900;
  maxFragments = 220;
  private time = 0;

  constructor() {
    for (let i = 0; i < 1400; i++) {
      this.particles.push({ kind: PK.Spark, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, rot: 0, vr: 0, grav: 0, drag: 0, color: '#fff' });
    }
    for (let i = 0; i < 300; i++) {
      this.fragments.push({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, life: 0, max: 1, n: 0, pts: new Float32Array(12), mat: null as unknown as Material, shade: 0 });
    }
  }

  setQuality(low: boolean): void {
    this.maxParticles = low ? 260 : 1400;
    this.maxFragments = low ? 60 : 300;
    this.np = Math.min(this.np, this.maxParticles);
    this.nf = Math.min(this.nf, this.maxFragments);
  }

  clear(): void { this.np = 0; this.nf = 0; this.trauma = 0; this.flash = 0; }

  spawn(kind: PK, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grav = 1, drag = 0): void {
    if (this.np >= this.maxParticles) return;
    const p = this.particles[this.np++];
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.color = color;
    p.rot = Math.random() * Math.PI * 2; p.vr = (Math.random() - 0.5) * 20;
    p.grav = grav; p.drag = drag;
  }

  shake(amount: number): void { this.trauma = Math.min(1, this.trauma + amount); }

  /** Éclats et poussières à l'impact (sans destruction). */
  impact(x: number, y: number, nx: number, ny: number, mat: Material, strength: number): void {
    const n = Math.round(3 + strength * 5);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.2;
      const s = 60 + Math.random() * 220 * strength;
      const vx = Math.cos(a) * s, vy = Math.sin(a) * s;
      switch (mat.particle) {
        case 'spark': this.spawn(PK.Spark, x, y, vx * 1.6, vy * 1.6, 0.18 + Math.random() * 0.25, 1.2, i % 2 ? '#ffd27a' : '#fff4d6', 0.6, 2); break;
        case 'shard': this.spawn(PK.Shard, x, y, vx, vy, 0.4 + Math.random() * 0.3, 1.5 + Math.random() * 2, mat.light, 1); break;
        case 'splinter': this.spawn(PK.Shard, x, y, vx * 0.7, vy * 0.7, 0.4 + Math.random() * 0.3, 1.5 + Math.random() * 2, mat.base, 1); break;
        case 'dust': this.spawn(PK.Dust, x, y, vx * 0.4, vy * 0.4, 0.5 + Math.random() * 0.5, 2 + Math.random() * 3, mat.light, -0.05, 3); break;
      }
    }
  }

  /** Brique brisée : fragments polygonaux soumis à la gravité + particules. */
  shatter(b: Brick, ix: number, iy: number, bvx: number, bvy: number, lowQ: boolean): void {
    const mat = b.mat;
    const cols = Math.max(2, Math.ceil((lowQ ? mat.fragments / 2 : mat.fragments) / 2));
    const rows = 2;
    const gx = cols + 1, gy = rows + 1;
    // grille de points jitterée (les pièces s'emboîtent)
    const px = new Float32Array(gx * gy), py = new Float32Array(gx * gy);
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
        px[j * gx + i] = b.x + (i / cols) * b.w + (edgeX ? 0 : (Math.random() - 0.5) * (b.w / cols) * 0.7);
        py[j * gx + i] = b.y + (j / rows) * b.h + (edgeY ? 0 : (Math.random() - 0.5) * (b.h / rows) * 0.8);
      }
    }
    const tri = mat.id === 'glass';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * gx + i, bb = a + 1, c = a + gx + 1, d = a + gx;
        if (tri) {
          this.piece(px, py, [a, bb, c], mat, ix, iy, bvx, bvy);
          this.piece(px, py, [a, c, d], mat, ix, iy, bvx, bvy);
        } else {
          this.piece(px, py, [a, bb, c, d], mat, ix, iy, bvx, bvy);
        }
      }
    }
    // particules
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const count = lowQ ? 6 : 16;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 200;
      const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.h;
      switch (mat.particle) {
        case 'shard': this.spawn(PK.Shard, x, y, Math.cos(a) * s + bvx * 0.2, Math.sin(a) * s, 0.5 + Math.random() * 0.6, 1 + Math.random() * 2.5, i % 3 ? mat.light : '#ffffff', 1); break;
        case 'splinter': this.spawn(PK.Shard, x, y, Math.cos(a) * s, Math.sin(a) * s - 60, 0.6 + Math.random() * 0.5, 1 + Math.random() * 2, i % 2 ? mat.light : mat.dark, 1); break;
        case 'dust': this.spawn(PK.Dust, x, y, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, 0.8 + Math.random() * 0.8, 3 + Math.random() * 5, mat.light, -0.04, 2.5); break;
        case 'spark': this.spawn(PK.Spark, x, y, Math.cos(a) * s * 1.8, Math.sin(a) * s * 1.8, 0.25 + Math.random() * 0.35, 1.3, i % 2 ? '#ffcf6e' : '#ffffff', 0.7, 1.5); break;
      }
    }
    if (mat.particle !== 'dust' && !lowQ) {
      for (let i = 0; i < 4; i++) this.spawn(PK.Dust, cx + (Math.random() - 0.5) * b.w, cy, (Math.random() - 0.5) * 40, -10 - Math.random() * 20, 0.7, 2 + Math.random() * 3, 'rgba(200,200,210,1)', -0.03, 2);
    }
  }

  private piece(px: Float32Array, py: Float32Array, idx: number[], mat: Material, ix: number, iy: number, bvx: number, bvy: number): void {
    if (this.nf >= this.maxFragments) return;
    const f = this.fragments[this.nf++];
    let cx = 0, cy = 0;
    for (const k of idx) { cx += px[k]; cy += py[k]; }
    cx /= idx.length; cy /= idx.length;
    f.n = idx.length;
    for (let k = 0; k < idx.length; k++) {
      f.pts[k * 2] = px[idx[k]] - cx;
      f.pts[k * 2 + 1] = py[idx[k]] - cy;
    }
    f.x = cx; f.y = cy; f.mat = mat;
    // éjection radiale depuis le point d'impact + quantité de mouvement de la balle
    let dx = cx - ix, dy = cy - iy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const power = 90 + Math.random() * 120;
    f.vx = dx * power + bvx * 0.25 + (Math.random() - 0.5) * 60;
    f.vy = dy * power + bvy * 0.2 - 60 - Math.random() * 80;
    f.rot = 0;
    f.vr = (Math.random() - 0.5) * 14;
    f.max = f.life = 1.4 + Math.random() * 1.2;
    f.shade = Math.random() * 0.35;
  }

  explosion(x: number, y: number, radius: number, lowQ: boolean): void {
    this.shake(0.55);
    this.flash = Math.min(1, this.flash + 0.5);
    this.spawn(PK.Ring, x, y, 0, 0, 0.45, radius, '#ffd9a0', 0);
    const n = lowQ ? 14 : 40;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 380;
      this.spawn(PK.Ember, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.5, 2 + Math.random() * 3, i % 3 ? '#ff9a3c' : '#fff1c0', 0.4, 2.5);
    }
    const sm = lowQ ? 4 : 12;
    for (let i = 0; i < sm; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 70;
      this.spawn(PK.Smoke, x, y, Math.cos(a) * s, Math.sin(a) * s - 20, 1 + Math.random(), 10 + Math.random() * 14, '#3a3634', -0.05, 1.5);
    }
  }

  update(dt: number, floorY: number): void {
    this.time += dt;
    // particules
    for (let i = 0; i < this.np; ) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > floorY + 60) {
        this.particles[i] = this.particles[--this.np];
        this.particles[this.np] = p;
        continue;
      }
      const k = p.drag ? Math.exp(-p.drag * dt) : 1;
      p.vx *= k; p.vy *= k;
      p.vy += GRAVITY * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      i++;
    }
    // fragments
    for (let i = 0; i < this.nf; ) {
      const f = this.fragments[i];
      f.life -= dt;
      if (f.life <= 0 || f.y > floorY + 80) {
        this.fragments[i] = this.fragments[--this.nf];
        this.fragments[this.nf] = f;
        continue;
      }
      f.vy += GRAVITY * dt;
      f.vx *= Math.exp(-0.4 * dt);
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.x < 4 && f.vx < 0) { f.x = 4; f.vx *= -0.5; }
      else if (f.x > WORLD_W - 4 && f.vx > 0) { f.x = WORLD_W - 4; f.vx *= -0.5; }
      i++;
    }
    // secousse (trauma²)
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 9;
    this.shakeX = s * Math.sin(this.time * 71.3) * Math.cos(this.time * 23.1);
    this.shakeY = s * Math.cos(this.time * 63.7) * Math.sin(this.time * 31.9);
    this.flash = Math.max(0, this.flash - dt * 3);
  }
}
