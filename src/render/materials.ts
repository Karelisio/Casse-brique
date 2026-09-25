import { BRICK_H, BRICK_W } from '../engine/config';
import type { MaterialId } from '../entities/materials';
import { mulberry32 } from '../levels/rng';

/**
 * Textures de briques pré-rendues (une fois par redimensionnement) à la
 * résolution écran exacte : le rendu en jeu n'est qu'un drawImage.
 */
export type Tex = HTMLCanvasElement;

const VARIANTS = 3;
const R = 2.5; // rayon des coins

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bevel(ctx: CanvasRenderingContext2D, w: number, h: number, light: string, dark: string): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = light;
  ctx.beginPath(); ctx.moveTo(R, 0.6); ctx.lineTo(w - R, 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.6, R); ctx.lineTo(0.6, h - R); ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.beginPath(); ctx.moveTo(R, h - 0.6); ctx.lineTo(w - R, h - 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 0.6, R); ctx.lineTo(w - 0.6, h - R); ctx.stroke();
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#9aa3ad');
  g.addColorStop(1, '#2a2e34');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawGlass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  roundRect(ctx, 0, 0, w, h, R);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(170,225,255,0.55)');
  g.addColorStop(0.5, 'rgba(80,165,220,0.42)');
  g.addColorStop(1, 'rgba(40,110,170,0.62)');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // reflet spéculaire diagonal
  const s = ctx.createLinearGradient(0, 0, w, h);
  s.addColorStop(0.18, 'rgba(255,255,255,0)');
  s.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  s.addColorStop(0.36, 'rgba(255,255,255,0.05)');
  s.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  s.addColorStop(0.56, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(2, 1.2, w - 4, 1.4);
  ctx.restore();
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, R);
  ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 1; ctx.stroke();
  roundRect(ctx, 2.5, 2.5, w - 5, h - 5, R - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke();
}

function drawWood(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number): void {
  roundRect(ctx, 0, 0, w, h, R);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const hue = 26 + rnd() * 8;
  g.addColorStop(0, `hsl(${hue},55%,55%)`);
  g.addColorStop(1, `hsl(${hue - 4},58%,30%)`);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // veines
  for (let i = 0; i < 9; i++) {
    const y0 = rnd() * h, amp = 0.6 + rnd() * 1.6, f = 0.08 + rnd() * 0.15, ph = rnd() * 6;
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '60,30,10' : '255,210,160'},${0.15 + rnd() * 0.25})`;
    ctx.lineWidth = 0.4 + rnd() * 0.6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = y0 + Math.sin(x * f + ph) * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // nœud
  if (rnd() < 0.7) {
    const kx = 6 + rnd() * (w - 12), ky = 4 + rnd() * (h - 8);
    const kg = ctx.createRadialGradient(kx, ky, 0.2, kx, ky, 3.5);
    kg.addColorStop(0, 'rgba(50,22,6,0.85)');
    kg.addColorStop(1, 'rgba(50,22,6,0)');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.ellipse(kx, ky, 4.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  // vernis
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(255,240,210,0.28)');
  v.addColorStop(0.4, 'rgba(255,240,210,0)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  bevel(ctx, w, h, 'rgba(255,220,170,0.55)', 'rgba(40,18,4,0.7)');
}

function drawStone(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number): void {
  roundRect(ctx, 0, 0, w, h, R - 1);
  const l = 50 + rnd() * 8;
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, `hsl(35,8%,${l + 8}%)`);
  g.addColorStop(1, `hsl(30,7%,${l - 18}%)`);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // grain
  for (let i = 0; i < w * h * 0.35; i++) {
    const a = rnd() * 0.22;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,250,240,${a})`;
    const s = 0.4 + rnd() * 1.1;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  // taches minérales
  for (let i = 0; i < 3; i++) {
    const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 4;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, `rgba(${rnd() < 0.5 ? '90,80,70' : '200,195,185'},0.35)`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  bevel(ctx, w, h, 'rgba(255,250,235,0.45)', 'rgba(0,0,0,0.6)');
}

function drawMetal(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, dark: boolean): void {
  roundRect(ctx, 0, 0, w, h, R - 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (dark) {
    g.addColorStop(0, '#6d7580'); g.addColorStop(0.45, '#3a4049'); g.addColorStop(0.55, '#2b3038'); g.addColorStop(1, '#4a525c');
  } else {
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(0.4, '#b3bcc7'); g.addColorStop(0.55, '#8a939e'); g.addColorStop(1, '#d4dae2');
  }
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // brossé
  for (let i = 0; i < h * 3; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * (dark ? 0.12 : 0.18)})`;
    ctx.fillRect(0, rnd() * h, w, 0.35);
  }
  if (dark) {
    // bandes de danger aux extrémités
    ctx.fillStyle = 'rgba(240,190,40,0.75)';
    for (const side of [0, 1]) {
      const x0 = side ? w - 7 : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, 0, 7, h); ctx.clip();
      for (let s = -h; s < 14; s += 5) {
        ctx.beginPath();
        ctx.moveTo(x0 + s, h); ctx.lineTo(x0 + s + h, 0); ctx.lineTo(x0 + s + h + 2.5, 0); ctx.lineTo(x0 + s + 2.5, h); ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.restore();
  bevel(ctx, w, h, 'rgba(255,255,255,0.8)', 'rgba(0,0,0,0.55)');
  const rr = 1.3;
  if (dark) { rivet(ctx, 10, h / 2, rr); rivet(ctx, w - 10, h / 2, rr); rivet(ctx, w / 2, h / 2, rr); }
  else { rivet(ctx, 3.2, 3.2, rr); rivet(ctx, w - 3.2, 3.2, rr); rivet(ctx, 3.2, h - 3.2, rr); rivet(ctx, w - 3.2, h - 3.2, rr); }
}

function drawExplosive(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  roundRect(ctx, 0, 0, w, h, R);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ff7a55'); g.addColorStop(0.45, '#c9311d'); g.addColorStop(1, '#6a120a');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // bande danger centrale
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(w * 0.3, 0, w * 0.4, h);
  ctx.fillStyle = '#f5c623';
  for (let s = -h; s < w * 0.4 + h; s += 6) {
    ctx.beginPath();
    const x = w * 0.3 + s;
    ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.lineTo(x + h + 3, 0); ctx.lineTo(x + 3, h); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w * 0.3, h); ctx.fillRect(w * 0.7, 0, w * 0.3, h);
  const s = ctx.createLinearGradient(0, 0, 0, h);
  s.addColorStop(0, 'rgba(255,255,255,0.45)'); s.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // symbole
  ctx.fillStyle = '#fff3d0';
  ctx.font = `bold ${h * 0.8}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', w * 0.15, h * 0.55); ctx.fillText('!', w * 0.85, h * 0.55);
  bevel(ctx, w, h, 'rgba(255,200,170,0.7)', 'rgba(40,0,0,0.7)');
}

export class Textures {
  bricks: Record<MaterialId, Tex[]> = {} as Record<MaterialId, Tex[]>;
  shadow!: Tex;
  glow!: Tex;
  background!: Tex;
  k = 1;
  pad = 6;

  build(k: number, worldW: number, worldH: number): void {
    this.k = k;
    const w = BRICK_W, h = BRICK_H;
    const ids: MaterialId[] = ['glass', 'wood', 'stone', 'metal', 'steel', 'explosive'];
    for (const id of ids) {
      this.bricks[id] = [];
      for (let v = 0; v < VARIANTS; v++) {
        const [c, ctx] = canvas(w * k, h * k);
        ctx.scale(k, k);
        const rnd = mulberry32(v * 977 + id.length * 31 + 7);
        switch (id) {
          case 'glass': drawGlass(ctx, w, h); break;
          case 'wood': drawWood(ctx, w, h, rnd); break;
          case 'stone': drawStone(ctx, w, h, rnd); break;
          case 'metal': drawMetal(ctx, w, h, rnd, false); break;
          case 'steel': drawMetal(ctx, w, h, rnd, true); break;
          case 'explosive': drawExplosive(ctx, w, h); break;
        }
        this.bricks[id].push(c);
      }
    }
    // ombre portée douce (via shadowBlur décalé hors cadre : compatible partout)
    {
      const p = this.pad;
      const [c, ctx] = canvas((w + p * 2) * k, (h + p * 2) * k);
      ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4 * k;
      ctx.shadowOffsetX = 1000 * k;
      ctx.fillStyle = '#000';
      roundRect(ctx, p - 1000, p, w, h, R);
      ctx.fill();
      this.shadow = c;
    }
    // halo de la balle
    {
      const r = 40;
      const [c, ctx] = canvas(r * 2 * k, r * 2 * k);
      ctx.scale(k, k);
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, 'rgba(255,240,200,0.9)');
      g.addColorStop(0.15, 'rgba(255,200,120,0.45)');
      g.addColorStop(0.45, 'rgba(255,140,60,0.12)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r * 2, r * 2);
      this.glow = c;
    }
    this.buildBackground(k, worldW, worldH);
  }

  private buildBackground(k: number, W: number, H: number): void {
    const [c, ctx] = canvas(W * k, H * k);
    ctx.scale(k, k);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141925'); g.addColorStop(0.6, '#0c0f16'); g.addColorStop(1, '#07080c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // mur de pierres sombres en arrière-plan
    const rnd = mulberry32(42);
    const bw = 50, bh = 24;
    for (let y = 0, row = 0; y < H; y += bh, row++) {
      for (let x = row % 2 ? -bw / 2 : 0; x < W; x += bw) {
        const l = 9 + rnd() * 5;
        ctx.fillStyle = `hsl(220,12%,${l}%)`;
        roundRect(ctx, x + 1, y + 1, bw - 2, bh - 2, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(x + 2, y + 1.5, bw - 4, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 2, y + bh - 2.5, bw - 4, 1);
      }
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.15, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    this.background = c;
  }
}
