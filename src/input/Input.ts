/**
 * Entrées : glisser au doigt (relatif, zone tactile = tout l'écran),
 * souris (absolu) et clavier (desktop).
 */
export class Input {
  /** position X cible de la raquette en unités monde (null = pas de consigne) */
  targetX: number | null = null;
  /** déclenché au relâchement d'un tap/glisser (lancer la balle) */
  onRelease: (() => void) | null = null;
  onPause: (() => void) | null = null;
  keyDir = 0;
  private active: number | null = null;
  private startFingerX = 0;
  private startPaddleX = 0;
  private sensitivity = 1.25;

  constructor(
    el: HTMLElement,
    private toWorldX: (clientX: number) => number,
    private worldScale: () => number,
    private paddleX: () => number,
  ) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.key);
    window.addEventListener('keyup', this.key);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  }

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    if (this.active !== null) return;
    this.active = e.pointerId;
    this.startFingerX = e.clientX;
    this.startPaddleX = this.paddleX();
    if (e.pointerType === 'mouse') this.targetX = this.toWorldX(e.clientX);
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      this.targetX = this.toWorldX(e.clientX);
      return;
    }
    if (e.pointerId !== this.active) return;
    e.preventDefault();
    const dx = (e.clientX - this.startFingerX) / this.worldScale();
    this.targetX = this.startPaddleX + dx * this.sensitivity;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.active) return;
    this.active = null;
    this.onRelease?.();
  };

  private key = (e: KeyboardEvent): void => {
    const down = e.type === 'keydown';
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'q' || k === 'a') this.keyDir = down ? -1 : this.keyDir === -1 ? 0 : this.keyDir;
    else if (k === 'ArrowRight' || k === 'd') this.keyDir = down ? 1 : this.keyDir === 1 ? 0 : this.keyDir;
    else if (down && (k === ' ' || k === 'ArrowUp')) this.onRelease?.();
    else if (down && (k === 'Escape' || k === 'p')) this.onPause?.();
    else return;
    e.preventDefault();
  };

  /** Annule le glisser en cours (changement d'écran). */
  reset(): void {
    this.active = null;
    this.targetX = null;
    this.keyDir = 0;
  }
}
