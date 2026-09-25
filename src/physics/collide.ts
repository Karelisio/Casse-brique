/**
 * Détection continue (CCD) cercle en mouvement vs AABB.
 * Principe : somme de Minkowski (boîte arrondie du rayon) + raycast.
 * Aucune allocation : le résultat est écrit dans `out`.
 */
export interface Hit {
  t: number; // fraction [0,1] du déplacement
  nx: number;
  ny: number;
}

export function makeHit(): Hit {
  return { t: 1, nx: 0, ny: 0 };
}

/** Rayon p + d·t contre cercle (c, r). Renvoie t ≥ 0 le plus petit, ou -1. */
function rayCircle(px: number, py: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
  const fx = px - cx;
  const fy = py - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t = (-b - s) / (2 * a);
  return t >= 0 ? t : -1;
}

export function sweepCircleAABB(
  px: number, py: number, dx: number, dy: number, r: number,
  x0: number, y0: number, x1: number, y1: number,
  out: Hit,
): boolean {
  // 1) chevauchement déjà présent (ex : la raquette a bougé sur la balle)
  const qx = px < x0 ? x0 : px > x1 ? x1 : px;
  const qy = py < y0 ? y0 : py > y1 ? y1 : py;
  const ox = px - qx;
  const oy = py - qy;
  const d2 = ox * ox + oy * oy;
  if (d2 < r * r - 1e-6) {
    let nx: number, ny: number;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = ox / d; ny = oy / d;
    } else {
      // centre dans la boîte : axe de pénétration minimale
      const l = px - x0, rr = x1 - px, t = py - y0, b = y1 - py;
      const m = Math.min(l, rr, t, b);
      nx = m === l ? -1 : m === rr ? 1 : 0;
      ny = nx !== 0 ? 0 : m === t ? -1 : 1;
    }
    if (dx * nx + dy * ny >= 0) return false; // s'éloigne
    out.t = 0; out.nx = nx; out.ny = ny;
    return true;
  }

  // 2) slabs sur la boîte élargie
  const ex0 = x0 - r, ey0 = y0 - r, ex1 = x1 + r, ey1 = y1 + r;
  let txMin = -Infinity, txMax = Infinity, tyMin = -Infinity, tyMax = Infinity;
  if (Math.abs(dx) < 1e-12) {
    if (px < ex0 || px > ex1) return false;
  } else {
    const a = (ex0 - px) / dx, b = (ex1 - px) / dx;
    txMin = Math.min(a, b); txMax = Math.max(a, b);
  }
  if (Math.abs(dy) < 1e-12) {
    if (py < ey0 || py > ey1) return false;
  } else {
    const a = (ey0 - py) / dy, b = (ey1 - py) / dy;
    tyMin = Math.min(a, b); tyMax = Math.max(a, b);
  }
  const tEnter = Math.max(txMin, tyMin);
  const tExit = Math.min(txMax, tyMax);
  if (tEnter > tExit || tExit < 0 || tEnter > 1) return false;

  const te = Math.max(tEnter, 0);
  const hx = px + dx * te;
  const hy = py + dy * te;
  const inX = hx >= x0 && hx <= x1;
  const inY = hy >= y0 && hy <= y1;
  if ((inX || inY) && tEnter >= 0) {
    // face
    if (txMin > tyMin) { out.nx = dx > 0 ? -1 : 1; out.ny = 0; }
    else { out.nx = 0; out.ny = dy > 0 ? -1 : 1; }
    out.t = tEnter;
    return true;
  }
  // 3) zone de coin : raycast contre le cercle du coin le plus proche
  const cx = hx < (x0 + x1) / 2 ? x0 : x1;
  const cy = hy < (y0 + y1) / 2 ? y0 : y1;
  const t = rayCircle(px, py, dx, dy, cx, cy, r);
  if (t < 0 || t > 1) return false;
  const nx = (px + dx * t - cx) / r;
  const ny = (py + dy * t - cy) / r;
  if (dx * nx + dy * ny >= 0) return false;
  out.t = t; out.nx = nx; out.ny = ny;
  return true;
}

/** Réflexion de v sur la normale n avec restitution. */
export function reflect(v: { vx: number; vy: number }, nx: number, ny: number, restitution = 1): void {
  const dot = v.vx * nx + v.vy * ny;
  if (dot >= 0) return;
  v.vx -= (1 + restitution) * dot * nx;
  v.vy -= (1 + restitution) * dot * ny;
}
