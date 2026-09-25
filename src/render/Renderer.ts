import { BRICK_H, BRICK_W, POWERUP_DURATION, WORLD_W } from '../engine/config';
import type { Game } from '../engine/Game';
import { POWERUP_INFO, TRAIL_MAX, type Ball, type PowerUp } from '../entities/entities';
import { progress } from '../engine/Settings';
import { PK } from './Fx';
import { roundRect, Textures } from './materials';

/**
 * Rendu Canvas 2D. Coordonnées monde (largeur 400) → écran via une seule transformation.
 * Éclairage : la balle est la source de lumière principale (halo additif,
 * éclairage des briques proches, ombres portées décalées à l'opposé).
 */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  tex = new Textures();
  k = 1; // pixels écran par unité monde
  offX = 0; // décalage horizontal (écrans larges)
  lowQ = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
  }

  resize(pxW: number, pxH: number, k: number, offX: number, worldH: number): void {
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    this.k = k;
    this.offX = offX;
    this.tex.build(k, WORLD_W, worldH);
  }

  /** alpha : interpolation entre deux pas physiques */
  render(g: Game, alpha: number): void {
    const ctx = this.ctx;
    const k = this.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, this.offX + g.fx.shakeX * k, g.fx.shakeY * k);

    ctx.drawImage(this.tex.background, 0, 0, WORLD_W, g.worldH);

    // position de la lumière principale (balle 0, interpolée)
    const main = g.balls[0];
    const lx = main ? main.px + (main.x - main.px) * alpha : WORLD_W / 2;
    const ly = main ? main.py + (main.y - main.py) * alpha : g.worldH * 0.7;
    const pierce = g.timers.pierce > 0;

    if (!this.lowQ) {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of g.balls) {
        const bx = b.px + (b.x - b.px) * alpha, by = b.py + (b.y - b.py) * alpha;
        const lg = ctx.createRadialGradient(bx, by, 0, bx, by, 190);
        lg.addColorStop(0, pierce ? 'rgba(255,90,120,0.22)' : 'rgba(255,190,110,0.2)');
        lg.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(bx - 190, by - 190, 380, 380);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // cadre (murs métalliques)
    this.drawFrame(g);
    this.drawBricks(g, lx, ly);
    this.drawFragments(g);
    for (const u of g.powerups) this.drawPowerup(u, g.time);
    this.drawLasers(g);
    this.drawPaddle(g, alpha);
    for (const b of g.balls) this.drawBall(b, alpha, pierce);
    this.drawParticles(g);

    if (g.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,220,170,${g.fx.flash * 0.35})`;
      ctx.fillRect(-20, -20, WORLD_W + 40, g.worldH + 40);
    }
    if (g.timers.slow > 0) {
      const a = Math.min(1, g.timers.slow) * 0.22;
      const v = ctx.createRadialGradient(WORLD_W / 2, g.worldH / 2, g.worldH * 0.3, WORLD_W / 2, g.worldH / 2, g.worldH * 0.7);
      v.addColorStop(0, 'rgba(90,60,200,0)');
      v.addColorStop(1, `rgba(90,60,200,${a})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, WORLD_W, g.worldH);
    }
    this.drawTexts(g);

    ctx.setTransform(k, 0, 0, k, this.offX, 0);
    this.drawHud(g);
  }

  private drawFrame(g: Game): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, g.top - 4, 0, g.top);
    grad.addColorStop(0, '#2a303b'); grad.addColorStop(1, '#8993a1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.top - 3, WORLD_W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, g.top, WORLD_W, 1);
  }

  private drawBricks(g: Game, lx: number, ly: number): void {
    const ctx = this.ctx;
    const tex = this.tex;
    const pad = tex.pad;
    // ombres portées : décalées à l'opposé de la lumière
    if (!this.lowQ) {
      ctx.globalAlpha = 0.55;
      for (const b of g.bricks) {
        if (!b.alive) continue;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        let dx = cx - lx, dy = cy - ly;
        const d = Math.hypot(dx, dy) || 1;
        const s = Math.min(5, 900 / (d + 60));
        dx = (dx / d) * s + 1.5; dy = (dy / d) * s + 3;
        ctx.drawImage(tex.shadow, b.x - pad + dx, b.y - pad + dy, b.w + pad * 2, b.h + pad * 2);
      }
      ctx.globalAlpha = 1;
    }
    const t = g.time;
    for (const b of g.bricks) {
      if (!b.alive) continue;
      const variants = tex.bricks[b.mat.id];
      const img = variants[b.seed % variants.length];
      let x = b.x, y = b.y, w = b.w, h = b.h;
      if (b.wobble > 0) {
        const s = Math.sin(b.wobble * 18) * b.wobble * 0.6;
        x -= s; y -= s * 0.5; w += s * 2; h += s;
      }
      if (b.mat.id === 'explosive') {
        // pulsation lumineuse
        const p = 0.5 + 0.5 * Math.sin(t * 6 + b.seed);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.25 + p * 0.25) * (b.fuse > 0 ? 2 : 1);
        ctx.drawImage(tex.glow, x + w / 2 - 30, y + h / 2 - 30, 60, 60);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(img, x, y, w, h);
      // usure : assombrissement selon les PV perdus
      if (b.maxHp !== Infinity && b.hp < b.maxHp) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - b.hp / b.maxHp) * 0.25})`;
        ctx.fillRect(x, y, w, h);
      }
      if (b.cracks.length) this.drawCracks(b.x, b.y, b.cracks, b.mat.id === 'glass');
    }
    // éclairage dynamique : un seul dégradé (coordonnées monde) appliqué aux briques proches
    if (!this.lowQ && g.balls.length) {
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 120);
      lg.addColorStop(0, 'rgba(255,225,170,0.5)');
      lg.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lg;
      for (const b of g.bricks) {
        if (!b.alive) continue;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (Math.abs(cx - lx) > 140 || Math.abs(cy - ly) > 130) continue;
        roundRect(ctx, b.x, b.y, b.w, b.h, 2.5);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // flash d'impact
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.bricks) {
      if (!b.alive || b.flash <= 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.5})`;
      roundRect(ctx, b.x, b.y, b.w, b.h, 2.5);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawCracks(bx: number, by: number, cracks: { pts: Float32Array }[], glass: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, BRICK_W, BRICK_H);
    ctx.clip();
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? (glass ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)') : 'rgba(10,6,4,0.85)';
      ctx.lineWidth = pass === 0 ? 1.3 : 0.8;
      const o = pass === 0 ? 0.5 : 0;
      ctx.beginPath();
      for (const c of cracks) {
        const p = c.pts;
        ctx.moveTo(bx + p[0] + o, by + p[1] + o);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(bx + p[i] + o, by + p[i + 1] + o);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFragments(g: Game): void {
    const ctx = this.ctx;
    const fx = g.fx;
    for (let i = 0; i < fx.nf; i++) {
      const f = fx.fragments[i];
      const a = Math.min(1, f.life / (f.max * 0.4));
      ctx.globalAlpha = a;
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      ctx.setTransform(this.k * c, this.k * s, -this.k * s, this.k * c, this.offX + (f.x + fx.shakeX) * this.k, (f.y + fx.shakeY) * this.k);
      ctx.beginPath();
      ctx.moveTo(f.pts[0], f.pts[1]);
      for (let j = 1; j < f.n; j++) ctx.lineTo(f.pts[j * 2], f.pts[j * 2 + 1]);
      ctx.closePath();
      const glass = f.mat.id === 'glass';
      ctx.fillStyle = glass ? 'rgba(150,215,250,0.45)' : f.mat.base;
      ctx.fill();
      if (!glass && f.shade > 0.05) {
        ctx.fillStyle = `rgba(0,0,0,${f.shade})`;
        ctx.fill();
      }
      ctx.strokeStyle = glass ? 'rgba(255,255,255,0.85)' : f.mat.light;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(this.k, 0, 0, this.k, this.offX + fx.shakeX * this.k, fx.shakeY * this.k);
  }

  private drawPowerup(u: PowerUp, t: number): void {
    const ctx = this.ctx;
    const info = POWERUP_INFO[u.kind];
    const w = 30, h = 14;
    const x = u.x - w / 2, y = u.y - h / 2;
    if (!this.lowQ) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 8);
      ctx.drawImage(this.tex.glow, u.x - 26, u.y - 26, 52, 52);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    roundRect(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, info.color);
    g.addColorStop(1, '#101010');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    this.drawIcon(u.kind, u.x, u.y, 4.5);
  }

  private drawIcon(kind: PowerUp['kind'], x: number, y: number, s: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0b0b0b';
    ctx.strokeStyle = '#0b0b0b';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (kind) {
      case 'multi':
        for (const dx of [-s, 0, s]) { ctx.moveTo(x + dx + 1.6, y); ctx.arc(x + dx, y, 1.6, 0, Math.PI * 2); }
        ctx.fill(); break;
      case 'wide':
        ctx.moveTo(x - s * 1.4, y); ctx.lineTo(x + s * 1.4, y);
        ctx.moveTo(x - s * 0.8, y - 2.5); ctx.lineTo(x - s * 1.4, y); ctx.lineTo(x - s * 0.8, y + 2.5);
        ctx.moveTo(x + s * 0.8, y - 2.5); ctx.lineTo(x + s * 1.4, y); ctx.lineTo(x + s * 0.8, y + 2.5);
        ctx.stroke(); break;
      case 'pierce':
        ctx.moveTo(x - s * 1.3, y); ctx.lineTo(x + s * 1.2, y);
        ctx.moveTo(x + s * 0.5, y - 3); ctx.lineTo(x + s * 1.3, y); ctx.lineTo(x + s * 0.5, y + 3);
        ctx.stroke(); break;
      case 'laser':
        ctx.moveTo(x + 1, y - 4.5); ctx.lineTo(x - 2.5, y + 0.5); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x - 1, y + 4.5);
        ctx.lineTo(x + 2.5, y - 0.8); ctx.lineTo(x - 0.5, y - 0.8); ctx.closePath(); ctx.fill(); break;
      case 'slow':
        ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - 2.8); ctx.moveTo(x, y); ctx.lineTo(x + 2.2, y);
        ctx.stroke(); break;
      case 'life':
        ctx.moveTo(x, y + 4);
        ctx.bezierCurveTo(x - 6, y - 0.5, x - 2.5, y - 5, x, y - 2);
        ctx.bezierCurveTo(x + 2.5, y - 5, x + 6, y - 0.5, x, y + 4);
        ctx.fill(); break;
    }
  }

  private drawLasers(g: Game): void {
    if (!g.lasers.length) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const l of g.lasers) {
      ctx.strokeStyle = 'rgba(255,60,60,0.45)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + 16); ctx.stroke();
      ctx.strokeStyle = '#ffe0e0'; ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawPaddle(g: Game, alpha: number): void {
    const ctx = this.ctx;
    const p = g.paddle;
    const x = p.px + (p.x - p.px) * alpha;
    const w = p.w, h = p.h;
    const x0 = x - w / 2, y0 = p.y - h / 2;
    // ombre
    if (!this.lowQ) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, x0 + 2, y0 + 6, w, h, h / 2);
      ctx.fill();
    }
    // corps métal poli
    roundRect(ctx, x0, y0, w, h, h / 2);
    const g1 = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g1.addColorStop(0, '#f7f9fc'); g1.addColorStop(0.35, '#a7b1bd'); g1.addColorStop(0.6, '#5a6370'); g1.addColorStop(1, '#9aa4b1');
    ctx.fillStyle = g1; ctx.fill();
    // embouts
    const capW = 11;
    ctx.save(); ctx.clip();
    const laser = g.timers.laser > 0;
    const capColor = laser ? '#ff3b3b' : g.timers.wide > 0 ? '#6be675' : '#ff9a3c';
    for (const cx of [x0, x0 + w - capW]) {
      const cg = ctx.createLinearGradient(0, y0, 0, y0 + h);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, capColor); cg.addColorStop(1, '#300');
      ctx.fillStyle = cg; ctx.fillRect(cx, y0, capW, h);
    }
    // bande d'énergie
    const e = 0.6 + 0.4 * Math.sin(g.time * 5) + p.flash;
    ctx.fillStyle = `rgba(120,200,255,${Math.min(1, 0.35 + e * 0.3)})`;
    ctx.fillRect(x0 + capW + 3, y0 + h * 0.46, w - capW * 2 - 6, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x0 + h / 2, y0 + 1.5, w - h, 1);
    ctx.restore();
    if (laser) {
      ctx.fillStyle = '#39404a';
      for (const cx of [x0 + 7, x0 + w - 7]) { ctx.fillRect(cx - 2, y0 - 5, 4, 6); ctx.fillStyle = '#ff5050'; ctx.fillRect(cx - 1, y0 - 6, 2, 2); ctx.fillStyle = '#39404a'; }
    }
    if (p.flash > 0 && !this.lowQ) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.flash * 0.6;
      ctx.drawImage(this.tex.glow, x - w / 2 - 10, p.y - 25, w + 20, 50);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawBall(b: Ball, alpha: number, pierce: boolean): void {
    const ctx = this.ctx;
    const x = b.px + (b.x - b.px) * alpha, y = b.py + (b.y - b.py) * alpha;
    const r = b.r;
    // traînée
    if (b.trailLen > 1) {
      ctx.globalCompositeOperation = 'lighter';
      const n = this.lowQ ? Math.min(6, b.trailLen) : b.trailLen;
      for (let i = 0; i < n; i++) {
        const idx = (b.trailHead - 1 - i + TRAIL_MAX * 2) % TRAIL_MAX;
        const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
        const f = 1 - i / n;
        ctx.fillStyle = pierce ? `rgba(255,70,110,${f * 0.35})` : `rgba(255,190,110,${f * 0.3})`;
        ctx.beginPath(); ctx.arc(tx, ty, r * (0.35 + f * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.tex.glow, x - 34, y - 34, 68, 68);
    ctx.globalCompositeOperation = 'source-over';
    // sphère
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (pierce) { g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff8aa5'); g.addColorStop(1, '#8a0f2c'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffeccc'); g.addColorStop(1, '#c98a45'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // bande de rotation (visualise le spin)
    ctx.strokeStyle = 'rgba(120,60,20,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.85, r * 0.3 * Math.abs(Math.cos(b.angle)) + 0.3, b.angle * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawParticles(g: Game): void {
    const ctx = this.ctx;
    const fx = g.fx;
    for (let i = 0; i < fx.np; i++) {
      const p = fx.particles[i];
      const f = p.life / p.max;
      switch (p.kind) {
        case PK.Spark: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = f;
          ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022); ctx.stroke();
          break;
        }
        case PK.Ember: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = f;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + f * 0.5), 0, Math.PI * 2); ctx.fill();
          break;
        }
        case PK.Shard: {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, f * 2);
          ctx.fillStyle = p.color;
          const s = p.size, c = Math.cos(p.rot) * s, sn = Math.sin(p.rot) * s;
          ctx.beginPath(); ctx.moveTo(p.x + c, p.y + sn); ctx.lineTo(p.x - sn * 0.6, p.y + c * 0.6); ctx.lineTo(p.x - c, p.y - sn); ctx.closePath(); ctx.fill();
          break;
        }
        case PK.Dust:
        case PK.Smoke: {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = f * (p.kind === PK.Smoke ? 0.5 : 0.28);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - f * 0.6), 0, Math.PI * 2); ctx.fill();
          break;
        }
        case PK.Ring: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = f * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * f + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.15 - f), 0, Math.PI * 2); ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTexts(g: Game): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    for (const t of g.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 2));
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawHud(g: Game): void {
    const ctx = this.ctx;
    const y = g.safeTop + 14;
    ctx.textBaseline = 'middle';
    // score
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8d97a8';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText('SCORE', 10, y - 6);
    ctx.fillStyle = '#f2f5fa';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText(String(g.score), 10, y + 9);
    // niveau / record
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8d97a8';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText(`NIVEAU ${g.levelIndex + 1}${g.procedural ? ' ∞' : ''}`, WORLD_W / 2 - 20, y - 6);
    ctx.fillStyle = '#ffd79b';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(`Record ${Math.max(progress.best, g.score)}`, WORLD_W / 2 - 20, y + 9);
    // vies (balles) — la zone droite est laissée au bouton pause
    const lives = Math.min(g.lives, 6);
    for (let i = 0; i < lives; i++) {
      const lx = WORLD_W - 64 - i * 13, ly = y + 1;
      const gr = ctx.createRadialGradient(lx - 1.5, ly - 1.5, 0.3, lx, ly, 4.5);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#ffe2b0'); gr.addColorStop(1, '#b8732e');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    // combo
    const mult = g.comboMult();
    if (mult > 1 && g.state === 'playing') {
      ctx.textAlign = 'center';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillStyle = `hsl(${30 + mult * 8},100%,65%)`;
      ctx.fillText(`COMBO ×${mult}`, WORLD_W / 2, g.top + 16);
    }
    // bonus actifs
    let bx = 10;
    const by = g.top + 8;
    for (const [k, v] of Object.entries(g.timers) as [keyof Game['timers'], number][]) {
      if (v <= 0) continue;
      const info = POWERUP_INFO[k];
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, bx, by, 34, 6, 3); ctx.fill();
      ctx.fillStyle = info.color;
      roundRect(ctx, bx, by, 34 * Math.min(1, v / POWERUP_DURATION), 6, 3); ctx.fill();
      bx += 40;
    }
    if (g.state === 'ready') {
      ctx.textAlign = 'center';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.fillStyle = '#e8eef8';
      ctx.fillText('Glisse pour placer · relâche pour lancer', WORLD_W / 2, g.paddle.y + 38);
      ctx.globalAlpha = 1;
    }
  }
}
