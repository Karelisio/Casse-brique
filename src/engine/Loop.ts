import { MAX_FRAME_DT, PHYS_DT } from './config';

/**
 * Boucle à pas fixe (physique 120 Hz, déterministe) + rendu interpolé à la
 * fréquence d'affichage (60/90/120 Hz).
 */
export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  /** FPS moyen lissé (pour la qualité automatique) */
  fps = 60;

  constructor(private step: (dt: number) => void, private render: (alpha: number) => void) {}

  start(): void {
    this.last = performance.now();
    const frame = (now: number): void => {
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
      if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT; // retour d'arrière-plan : pas de rattrapage géant
      this.acc += dt;
      let n = 0;
      while (this.acc >= PHYS_DT && n < 16) {
        this.step(PHYS_DT);
        this.acc -= PHYS_DT;
        n++;
      }
      this.render(this.acc / PHYS_DT);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void { cancelAnimationFrame(this.raf); }
}
