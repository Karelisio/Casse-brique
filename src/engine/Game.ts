import {
  BALL_SPEED_GAIN, BALL_SPEED_MAX, BALL_SPEED_START, BRICK_GAP, BRICK_H, BRICK_MARGIN, BRICK_W, COLS, HUD_H,
  LASER_INTERVAL, LASER_SPEED, LIVES, MAX_BALLS, MAX_BOUNCE_ANGLE, MIN_VY_RATIO, MIN_WORLD_H, PADDLE_W,
  POWERUP_CHANCE, POWERUP_DURATION, POWERUP_SPEED, WORLD_W,
} from './config';
import { progress, saveProgress } from './Settings';
import {
  createBall, createBrick, createPaddle, pushTrail, POWERUP_INFO,
  type Ball, type Brick, type Crack, type Laser, type Paddle, type PowerUp, type PowerUpKind,
} from '../entities/entities';
import { makeHit, reflect, sweepCircleAABB } from '../physics/collide';
import { Fx, PK } from '../render/Fx';
import { audio } from '../audio/Audio';
import { vibrate } from '../platform/haptics';
import { getLevel } from '../levels/Levels';
import type { Input } from '../input/Input';

export type State = 'menu' | 'ready' | 'playing' | 'paused' | 'levelclear' | 'gameover';

export interface FloatText { x: number; y: number; text: string; color: string; life: number; }

const HIT = makeHit();
const EXPLOSION_RADIUS = BRICK_W * 1.75;

export class Game {
  state: State = 'menu';
  worldH = MIN_WORLD_H;
  safeTop = 0;
  safeBottom = 0;
  top = HUD_H; // bord supérieur de l'aire de jeu
  brickTop = HUD_H + 30;

  balls: Ball[] = [];
  paddle: Paddle = createPaddle(WORLD_W / 2, MIN_WORLD_H - 100);
  bricks: Brick[] = [];
  powerups: PowerUp[] = [];
  lasers: Laser[] = [];
  texts: FloatText[] = [];
  fx = new Fx();

  levelIndex = 0;
  levelName = '';
  procedural = false;
  score = 0;
  lives = LIVES;
  combo = 0;
  bestCombo = 0;
  speed = BALL_SPEED_START;
  time = 0;
  lowQ = false;
  newBest = false;
  timers: Record<'wide' | 'pierce' | 'laser' | 'slow', number> = { wide: 0, pierce: 0, laser: 0, slow: 0 };
  private laserCd = 0;
  private wallSoundCd = 0;

  onState: ((s: State) => void) | null = null;

  constructor(private input: Input) {}

  // ---------- mise en page ----------
  layout(worldH: number, safeTop: number, safeBottom: number): void {
    const oldBrickTop = this.brickTop;
    const oldPaddleY = this.paddle.y;
    this.worldH = worldH;
    this.safeTop = safeTop;
    this.safeBottom = safeBottom;
    this.top = safeTop + HUD_H;
    this.brickTop = this.top + 34;
    this.paddle.y = worldH - safeBottom - Math.max(72, worldH * 0.12);
    const dy = this.brickTop - oldBrickTop;
    for (const b of this.bricks) b.y += dy;
    const dp = this.paddle.y - oldPaddleY;
    for (const b of this.balls) if (b.stuck) { b.y += dp; b.py = b.y; }
  }

  private setState(s: State): void {
    this.state = s;
    this.onState?.(s);
  }

  // ---------- cycle de partie ----------
  newGame(levelIndex: number): void {
    this.score = 0;
    this.lives = LIVES;
    this.bestCombo = 0;
    this.newBest = false;
    this.loadLevel(levelIndex);
  }

  loadLevel(index: number): void {
    const def = getLevel(index);
    this.levelIndex = index;
    this.levelName = def.name;
    this.procedural = def.procedural;
    this.bricks = [];
    def.grid.forEach((row, r) => {
      row.forEach((m, c) => {
        if (!m) return;
        const x = BRICK_MARGIN + c * (BRICK_W + BRICK_GAP);
        const y = this.brickTop + r * (BRICK_H + BRICK_GAP);
        this.bricks.push(createBrick(x, y, BRICK_W, BRICK_H, m, (index * 131 + r * COLS + c) * 7919));
      });
    });
    this.powerups.length = 0;
    this.lasers.length = 0;
    this.texts.length = 0;
    this.fx.clear();
    this.speed = Math.min(BALL_SPEED_START + index * 7, BALL_SPEED_START + 110);
    this.resetRound();
    this.addText(WORLD_W / 2, this.paddle.y - 120, def.name, '#ffd79b', 1.8);
  }

  private resetRound(): void {
    for (const k of Object.keys(this.timers) as (keyof Game['timers'])[]) this.timers[k] = 0;
    this.paddle.targetW = PADDLE_W;
    this.paddle.w = PADDLE_W;
    this.combo = 0;
    const b = createBall(this.paddle.x, this.paddle.y - this.paddle.h / 2 - 7);
    b.stuck = true;
    b.stuckOffset = 0;
    this.balls = [b];
    this.lasers.length = 0;
    this.input.reset();
    this.setState('ready');
  }

  launch(): void {
    if (this.state !== 'ready') return;
    audio.unlock();
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const a = (b.stuckOffset / (this.paddle.w / 2)) * 0.6 + (Math.random() - 0.5) * 0.25 + this.paddle.vx * 0.0003;
      b.vx = Math.sin(a) * this.speed;
      b.vy = -Math.cos(a) * this.speed;
      b.spin = this.paddle.vx * 0.02;
    }
    audio.paddle(0.6);
    vibrate(8);
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing' || this.state === 'ready') {
      this.setState('paused');
      this.input.reset();
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    const stuck = this.balls.some((b) => b.stuck);
    this.setState(stuck ? 'ready' : 'playing');
  }

  nextLevel(): void {
    this.loadLevel(this.levelIndex + 1);
  }

  toMenu(): void {
    this.setState('menu');
  }

  // ---------- mise à jour (pas fixe) ----------
  step(dt: number): void {
    // les effets continuent en pause/menu pour l'ambiance, mais pas la physique
    const active = this.state === 'playing' || this.state === 'ready';
    const slow = this.timers.slow > 0 ? 0.55 : 1;
    const gdt = dt * slow;
    this.fx.update(active ? gdt : dt * 0.5, this.worldH);
    this.updateTexts(dt);
    if (!active) return;
    this.time += dt;

    this.updatePaddle(dt);
    for (const b of this.bricks) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5);
      if (b.wobble > 0) b.wobble = Math.max(0, b.wobble - dt * 6);
    }

    if (this.state === 'ready') {
      for (const b of this.balls) {
        b.px = b.x; b.py = b.y;
        b.x = this.paddle.x + b.stuckOffset;
        b.y = this.paddle.y - this.paddle.h / 2 - b.r - 0.5;
        b.trailLen = 0;
      }
      return;
    }

    // timers de bonus
    for (const k of Object.keys(this.timers) as (keyof Game['timers'])[]) {
      if (this.timers[k] > 0) {
        this.timers[k] = Math.max(0, this.timers[k] - dt);
        if (this.timers[k] === 0 && k === 'wide') this.paddle.targetW = PADDLE_W;
      }
    }

    this.speed = Math.min(BALL_SPEED_MAX, this.speed + BALL_SPEED_GAIN * dt);

    for (const b of this.balls) {
      if (!b.alive) continue;
      b.px = b.x; b.py = b.y;
      // effet Magnus léger : la balle qui tourne courbe sa trajectoire
      const turn = b.spin * 0.012 * gdt;
      if (turn !== 0) {
        const c = Math.cos(turn), s = Math.sin(turn);
        const vx = b.vx * c - b.vy * s;
        b.vy = b.vx * s + b.vy * c;
        b.vx = vx;
      }
      b.spin *= Math.exp(-0.9 * gdt);
      b.angle += b.spin * gdt;
      this.normalize(b);
      this.moveBall(b, gdt);
      pushTrail(b);
      if (b.y - b.r > this.worldH + 20) b.alive = false;
    }
    if (this.balls.some((b) => !b.alive)) this.balls = this.balls.filter((b) => b.alive);
    if (this.balls.length === 0) { this.loseLife(); return; }

    this.updatePowerups(gdt);
    this.updateLasers(dt);
    this.updateFuses(dt);
    this.wallSoundCd -= dt;

    if (!this.bricks.some((b) => b.alive && b.mat.id !== 'steel')) this.levelClear();
  }

  private updatePaddle(dt: number): void {
    const p = this.paddle;
    p.px = p.x;
    p.w += (p.targetW - p.w) * Math.min(1, dt * 10);
    if (this.input.keyDir !== 0) {
      this.input.targetX = (this.input.targetX ?? p.x) + this.input.keyDir * 560 * dt;
    }
    const half = p.w / 2;
    if (this.input.targetX !== null) {
      this.input.targetX = Math.max(half, Math.min(WORLD_W - half, this.input.targetX));
      p.targetX = this.input.targetX;
    }
    p.targetX = Math.max(half, Math.min(WORLD_W - half, p.targetX));
    p.x += (p.targetX - p.x) * Math.min(1, dt * 28);
    p.vx = (p.x - p.px) / dt;
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 4);
  }

  /** Vitesse constante + composante verticale minimale (anti-boucle horizontale). */
  private normalize(b: Ball): void {
    const s = this.speed;
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / len) * s;
    b.vy = (b.vy / len) * s;
    if (Math.abs(b.vy) < s * MIN_VY_RATIO) {
      b.vy = (b.vy < 0 ? -1 : 1) * s * MIN_VY_RATIO;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(s * s - b.vy * b.vy);
    }
  }

  // ---------- CCD de la balle ----------
  private moveBall(b: Ball, dt: number): void {
    let rem = dt;
    for (let iter = 0; iter < 8 && rem > 1e-7; iter++) {
      const dx = b.vx * rem, dy = b.vy * rem;
      let bestT = 2, nx = 0, ny = 0;
      let kind = 0; // 1 mur, 2 brique, 3 raquette
      let target: Brick | null = null;

      // murs (plans)
      if (dx < 0 && b.x + dx < b.r) { const t = (b.r - b.x) / dx; if (t < bestT) { bestT = Math.max(0, t); nx = 1; ny = 0; kind = 1; } }
      if (dx > 0 && b.x + dx > WORLD_W - b.r) { const t = (WORLD_W - b.r - b.x) / dx; if (t < bestT) { bestT = Math.max(0, t); nx = -1; ny = 0; kind = 1; } }
      if (dy < 0 && b.y + dy < this.top + b.r) { const t = (this.top + b.r - b.y) / dy; if (t < bestT) { bestT = Math.max(0, t); nx = 0; ny = 1; kind = 1; } }

      // briques (pré-filtre par boîte englobante du balayage)
      const minX = Math.min(b.x, b.x + dx) - b.r, maxX = Math.max(b.x, b.x + dx) + b.r;
      const minY = Math.min(b.y, b.y + dy) - b.r, maxY = Math.max(b.y, b.y + dy) + b.r;
      for (const br of this.bricks) {
        if (!br.alive || br.x > maxX || br.x + br.w < minX || br.y > maxY || br.y + br.h < minY) continue;
        if (sweepCircleAABB(b.x, b.y, dx, dy, b.r, br.x, br.y, br.x + br.w, br.y + br.h, HIT) && HIT.t < bestT) {
          bestT = HIT.t; nx = HIT.nx; ny = HIT.ny; kind = 2; target = br;
        }
      }

      // raquette
      const p = this.paddle;
      if (sweepCircleAABB(b.x, b.y, dx, dy, b.r, p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2, HIT) && HIT.t < bestT) {
        bestT = HIT.t; nx = HIT.nx; ny = HIT.ny; kind = 3;
      }

      if (kind === 0) { b.x += dx; b.y += dy; break; }

      b.x += dx * bestT + nx * 0.01;
      b.y += dy * bestT + ny * 0.01;
      rem *= 1 - bestT;

      if (kind === 1) this.hitWall(b, nx, ny);
      else if (kind === 2 && target) this.hitBrick(b, target, nx, ny);
      else if (kind === 3) this.hitPaddle(b, nx, ny);
    }
    b.x = Math.max(b.r, Math.min(WORLD_W - b.r, b.x));
    if (b.y < this.top + b.r) b.y = this.top + b.r;
  }

  private hitWall(b: Ball, nx: number, ny: number): void {
    reflect(b, nx, ny);
    // frottement : le spin se transfère un peu en vitesse tangentielle
    const tx = -ny, ty = nx;
    b.vx += tx * b.spin * 1.5; b.vy += ty * b.spin * 1.5;
    b.spin *= 0.6;
    if (this.wallSoundCd <= 0) { audio.wall(); this.wallSoundCd = 0.05; }
    if (!this.lowQ) for (let i = 0; i < 3; i++) this.fx.spawn(PK.Spark, b.x - nx * b.r, b.y - ny * b.r, nx * 80 + (Math.random() - 0.5) * 120, ny * 80 + (Math.random() - 0.5) * 120, 0.15, 1, '#cfe3ff', 0, 3);
  }

  private hitBrick(b: Ball, br: Brick, nx: number, ny: number): void {
    const ix = b.x - nx * b.r, iy = b.y - ny * b.r;
    const pierce = this.timers.pierce > 0 && br.mat.id !== 'steel';
    if (pierce) {
      this.damage(br, 99, ix, iy, nx, ny, b.vx, b.vy);
      return;
    }
    const impactSpeed = Math.abs(b.vx * nx + b.vy * ny);
    reflect(b, nx, ny);
    const tx = -ny, ty = nx;
    const vt = b.vx * tx + b.vy * ty;
    b.vx += tx * b.spin * 1.2; b.vy += ty * b.spin * 1.2;
    b.spin = b.spin * 0.5 - vt * 0.004;
    this.damage(br, 1, ix, iy, nx, ny, b.vx, b.vy, impactSpeed / BALL_SPEED_MAX);
  }

  private hitPaddle(b: Ball, nx: number, ny: number): void {
    const p = this.paddle;
    if (ny < -0.35) {
      // angle selon le point d'impact
      const off = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2 + b.r * 0.5)));
      let a = off * MAX_BOUNCE_ANGLE + p.vx * 0.00035;
      a = Math.max(-MAX_BOUNCE_ANGLE, Math.min(MAX_BOUNCE_ANGLE, a));
      b.vx = Math.sin(a) * this.speed;
      b.vy = -Math.cos(a) * this.speed;
      b.spin = Math.max(-40, Math.min(40, b.spin * 0.3 + p.vx * 0.025));
      b.y = Math.min(b.y, p.y - p.h / 2 - b.r - 0.01);
    } else {
      reflect(b, nx, ny);
      b.vx += p.vx * 0.5;
    }
    p.flash = 1;
    if (this.combo >= 4) this.addText(p.x, p.y - 26, `Combo ×${this.comboMult()} terminé`, '#9fd7ff', 0.9);
    this.combo = 0;
    audio.paddle(0.8);
    vibrate(10);
    if (!this.lowQ) for (let i = 0; i < 5; i++) this.fx.spawn(PK.Spark, b.x, b.y + b.r, (Math.random() - 0.5) * 200, -Math.random() * 150, 0.2, 1, '#bfe2ff', 0.5, 3);
  }

  comboMult(): number { return Math.min(8, 1 + Math.floor(this.combo / 4)); }

  // ---------- briques ----------
  damage(br: Brick, dmg: number, ix: number, iy: number, nx: number, ny: number, vx: number, vy: number, strength = 0.6): void {
    if (!br.alive) return;
    br.flash = 1;
    br.wobble = 1;
    if (br.mat.id === 'steel') {
      this.fx.impact(ix, iy, nx, ny, br.mat, 1);
      audio.hit('steel', strength);
      this.fx.shake(0.06);
      vibrate(6);
      return;
    }
    br.hp -= dmg;
    if (br.hp > 0) {
      this.addCracks(br, ix - br.x, iy - br.y);
      this.fx.impact(ix, iy, nx, ny, br.mat, 0.5 + strength);
      audio.hit(br.mat.id, strength);
      this.fx.shake(0.05);
      vibrate(12);
      return;
    }
    this.destroy(br, ix, iy, vx, vy);
  }

  private destroy(br: Brick, ix: number, iy: number, vx: number, vy: number): void {
    br.alive = false;
    this.fx.shatter(br, ix, iy, vx, vy, this.lowQ);
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.comboMult();
    const pts = br.mat.score * mult;
    this.score += pts;
    this.addText(br.x + br.w / 2, br.y, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, mult > 1 ? '#ffcf6e' : '#ffffff', 0.7);
    audio.breakSound(br.mat.id);
    this.fx.shake(0.12);
    vibrate(22);
    if (br.mat.id === 'explosive') this.explode(br);
    else if (Math.random() < POWERUP_CHANCE) this.spawnPowerup(br.x + br.w / 2, br.y + br.h / 2);
  }

  private explode(src: Brick): void {
    const cx = src.x + src.w / 2, cy = src.y + src.h / 2;
    this.fx.explosion(cx, cy, EXPLOSION_RADIUS, this.lowQ);
    audio.explosion();
    vibrate([40, 20, 60], true);
    for (const br of this.bricks) {
      if (!br.alive || br.mat.id === 'steel') continue;
      const dx = br.x + br.w / 2 - cx, dy = br.y + br.h / 2 - cy;
      if (dx * dx + dy * dy > EXPLOSION_RADIUS * EXPLOSION_RADIUS) continue;
      if (br.mat.id === 'explosive') { if (br.fuse <= 0) br.fuse = 0.12; }
      else this.destroy(br, cx, cy, dx * 4, dy * 4);
    }
  }

  private updateFuses(dt: number): void {
    for (const br of this.bricks) {
      if (!br.alive || br.fuse <= 0) continue;
      br.fuse -= dt;
      br.flash = 1;
      if (br.fuse <= 0) this.destroy(br, br.x + br.w / 2, br.y + br.h / 2, 0, 0);
    }
  }

  /** Fissures procédurales partant du point d'impact (coordonnées locales). */
  private addCracks(br: Brick, lx: number, ly: number): void {
    lx = Math.max(1, Math.min(br.w - 1, lx));
    ly = Math.max(1, Math.min(br.h - 1, ly));
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const segs = 3 + Math.floor(Math.random() * 3);
      const pts = new Float32Array((segs + 1) * 2);
      let x = lx, y = ly;
      let a = Math.random() * Math.PI * 2;
      pts[0] = x; pts[1] = y;
      for (let s = 1; s <= segs; s++) {
        a += (Math.random() - 0.5) * 1.2;
        const len = 3 + Math.random() * (br.w * 0.14);
        x = Math.max(0, Math.min(br.w, x + Math.cos(a) * len));
        y = Math.max(0, Math.min(br.h, y + Math.sin(a) * len * 0.6));
        pts[s * 2] = x; pts[s * 2 + 1] = y;
      }
      const c: Crack = { pts };
      br.cracks.push(c);
    }
    if (br.cracks.length > 14) br.cracks.splice(0, br.cracks.length - 14);
  }

  // ---------- bonus ----------
  private spawnPowerup(x: number, y: number): void {
    const table: [PowerUpKind, number][] = [['multi', 22], ['wide', 20], ['pierce', 13], ['laser', 14], ['slow', 17], ['life', this.lives < 5 ? 5 : 0]];
    const total = table.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * total;
    let kind: PowerUpKind = 'multi';
    for (const [k, w] of table) if ((r -= w) <= 0) { kind = k; break; }
    this.powerups.push({ kind, x, y, vy: POWERUP_SPEED, t: 0, alive: true });
  }

  private updatePowerups(dt: number): void {
    const p = this.paddle;
    for (const u of this.powerups) {
      u.t += dt;
      u.y += u.vy * dt;
      if (u.y > this.worldH + 20) { u.alive = false; continue; }
      if (Math.abs(u.x - p.x) < p.w / 2 + 12 && Math.abs(u.y - p.y) < p.h / 2 + 8) {
        u.alive = false;
        this.apply(u.kind);
      }
    }
    if (this.powerups.some((u) => !u.alive)) this.powerups = this.powerups.filter((u) => u.alive);
  }

  private apply(kind: PowerUpKind): void {
    const info = POWERUP_INFO[kind];
    this.addText(this.paddle.x, this.paddle.y - 34, info.label, info.color, 1.1);
    audio.powerup();
    vibrate([15, 30, 15], true);
    this.score += 50;
    switch (kind) {
      case 'multi': {
        const add: Ball[] = [];
        for (const b of this.balls) {
          for (const da of [-0.4, 0.4]) {
            if (this.balls.length + add.length >= MAX_BALLS) break;
            const n = createBall(b.x, b.y);
            const c = Math.cos(da), s = Math.sin(da);
            n.vx = b.vx * c - b.vy * s;
            n.vy = b.vx * s + b.vy * c;
            n.spin = -b.spin;
            add.push(n);
          }
        }
        this.balls.push(...add);
        break;
      }
      case 'wide': this.timers.wide = POWERUP_DURATION; this.paddle.targetW = PADDLE_W * 1.55; break;
      case 'pierce': this.timers.pierce = POWERUP_DURATION * 0.75; break;
      case 'laser': this.timers.laser = POWERUP_DURATION * 0.8; this.laserCd = 0; break;
      case 'slow': this.timers.slow = POWERUP_DURATION * 0.7; break;
      case 'life': this.lives++; break;
    }
  }

  private updateLasers(dt: number): void {
    const p = this.paddle;
    if (this.timers.laser > 0) {
      this.laserCd -= dt;
      if (this.laserCd <= 0) {
        this.laserCd = LASER_INTERVAL;
        this.lasers.push({ x: p.x - p.w / 2 + 7, y: p.y - p.h / 2, alive: true });
        this.lasers.push({ x: p.x + p.w / 2 - 7, y: p.y - p.h / 2, alive: true });
        audio.laser();
      }
    }
    for (const l of this.lasers) {
      const ny = l.y - LASER_SPEED * dt;
      if (ny < this.top) { l.alive = false; continue; }
      let hit: Brick | null = null;
      let hy = -Infinity;
      for (const br of this.bricks) {
        if (!br.alive || l.x < br.x || l.x > br.x + br.w) continue;
        const bottom = br.y + br.h;
        if (bottom <= l.y && bottom >= ny && bottom > hy) { hy = bottom; hit = br; }
        else if (l.y >= br.y && l.y <= bottom) { hy = l.y; hit = br; }
      }
      if (hit) {
        l.alive = false;
        this.damage(hit, 1, l.x, hy, 0, 1, 0, -200, 0.4);
        if (!this.lowQ) for (let i = 0; i < 4; i++) this.fx.spawn(PK.Spark, l.x, hy, (Math.random() - 0.5) * 160, Math.random() * 120, 0.2, 1, '#ff8a8a', 0.5, 2);
      } else l.y = ny;
    }
    if (this.lasers.some((l) => !l.alive)) this.lasers = this.lasers.filter((l) => l.alive);
  }

  // ---------- vies / fin ----------
  private loseLife(): void {
    this.lives--;
    audio.lose();
    vibrate([60, 40, 90], true);
    this.fx.shake(0.5);
    this.powerups.length = 0;
    this.speed = Math.max(BALL_SPEED_START + this.levelIndex * 5, this.speed * 0.88);
    if (this.lives <= 0) {
      this.lives = 0;
      this.commitBest();
      this.setState('gameover');
      return;
    }
    this.addText(WORLD_W / 2, this.paddle.y - 90, 'Balle perdue', '#ff7a7a', 1.2);
    this.resetRound();
  }

  private levelClear(): void {
    const bonus = this.lives * 250 + this.bestCombo * 20;
    this.score += bonus;
    progress.unlocked = Math.max(progress.unlocked, this.levelIndex + 1);
    this.commitBest();
    audio.win();
    vibrate([20, 40, 20, 40, 60], true);
    this.powerups.length = 0;
    this.lasers.length = 0;
    this.setState('levelclear');
  }

  private commitBest(): void {
    if (this.score > progress.best) { progress.best = this.score; this.newBest = true; }
    saveProgress();
  }

  // ---------- textes flottants ----------
  addText(x: number, y: number, text: string, color: string, life: number): void {
    if (this.texts.length > 24) this.texts.shift();
    this.texts.push({ x: x + (Math.random() - 0.5) * 16, y: y - Math.random() * 10, text, color, life });
  }
  private updateTexts(dt: number): void {
    for (const t of this.texts) { t.life -= dt; t.y -= 28 * dt; }
    if (this.texts.length && this.texts[0].life <= 0) this.texts = this.texts.filter((t) => t.life > 0);
  }
}
