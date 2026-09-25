import type { Game, State } from '../engine/Game';
import { progress, saveSettings, settings, type Quality } from '../engine/Settings';
import { HANDMADE_COUNT } from '../levels/Levels';
import { audio } from '../audio/Audio';
import { enterFullscreen, lockPortrait } from '../platform/native';

type Screen = 'main' | 'levels' | 'settings' | 'pause' | 'levelclear' | 'gameover' | 'none';

/** Menus en surimpression DOM (accessibles, nets à toute résolution). */
export class Menu {
  private screen: Screen = 'main';
  private back: Screen = 'main';
  private pauseBtn: HTMLButtonElement;

  constructor(private root: HTMLElement, private game: Game, private onQuality: () => void) {
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'hud-btn';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';
    this.pauseBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.pause(); });
    game.onState = (s) => this.onState(s);
    this.show('main');
  }

  private onState(s: State): void {
    const map: Partial<Record<State, Screen>> = { menu: 'main', paused: 'pause', levelclear: 'levelclear', gameover: 'gameover', ready: 'none', playing: 'none' };
    const next = map[s];
    if (next && next !== this.screen) this.show(next);
  }

  /** Bouton retour Android */
  handleBack(): void {
    if (this.screen === 'none') this.game.pause();
    else if (this.screen === 'pause') this.game.resume();
    else if (this.screen === 'levels' || this.screen === 'settings') this.show(this.back);
  }

  private startLevel(i: number): void {
    audio.unlock();
    enterFullscreen().then(lockPortrait);
    this.game.newGame(i);
  }

  show(screen: Screen): void {
    this.screen = screen;
    this.root.innerHTML = '';
    if (screen === 'none') {
      this.root.appendChild(this.pauseBtn);
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    overlay.appendChild(panel);
    overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(overlay);
    const g = this.game;

    const btn = (label: string, fn: () => void, primary = false): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'btn' + (primary ? ' primary' : '');
      b.textContent = label;
      b.addEventListener('click', () => { audio.unlock(); audio.click(); fn(); });
      panel.appendChild(b);
      return b;
    };
    const html = (s: string): void => { panel.insertAdjacentHTML('beforeend', s); };

    switch (screen) {
      case 'main': {
        const lvl = Math.min(progress.unlocked, 999);
        html(`<div class="title">CASSE-BRIQUE</div><p class="sub">Verre · Bois · Pierre · Métal</p>`);
        html(`<div class="stats"><div><b>${progress.best}</b>Record</div><div><b>${lvl + 1}</b>Niveau</div></div>`);
        btn(lvl > 0 ? `Jouer — niveau ${lvl + 1}` : 'Jouer', () => this.startLevel(lvl), true);
        btn('Niveaux', () => { this.back = 'main'; this.show('levels'); });
        btn('Réglages', () => { this.back = 'main'; this.show('settings'); });
        break;
      }
      case 'levels': {
        html('<h2>Niveaux</h2>');
        const grid = document.createElement('div');
        grid.className = 'grid';
        const count = Math.max(HANDMADE_COUNT + 10, Math.ceil((progress.unlocked + 2) / 4) * 4);
        for (let i = 0; i < count; i++) {
          const b = document.createElement('button');
          b.textContent = String(i + 1);
          if (i >= HANDMADE_COUNT) b.classList.add('proc');
          b.disabled = i > progress.unlocked;
          b.addEventListener('click', () => { audio.click(); this.startLevel(i); });
          grid.appendChild(b);
        }
        panel.appendChild(grid);
        html(`<p class="sub" style="margin-top:12px">Niveaux ${HANDMADE_COUNT + 1}+ générés procéduralement</p>`);
        btn('Retour', () => this.show(this.back));
        break;
      }
      case 'settings': {
        html('<h2>Réglages</h2>');
        const row = (label: string, opts: [string, string][], get: () => string, set: (v: string) => void): void => {
          const r = document.createElement('div');
          r.className = 'row';
          r.innerHTML = `<span>${label}</span>`;
          const seg = document.createElement('div');
          seg.className = 'seg';
          for (const [v, l] of opts) {
            const b = document.createElement('button');
            b.textContent = l;
            if (get() === v) b.classList.add('on');
            b.addEventListener('click', () => {
              set(v); saveSettings(); audio.unlock(); audio.click();
              seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
            });
            seg.appendChild(b);
          }
          r.appendChild(seg);
          panel.appendChild(r);
        };
        const onOff: [string, string][] = [['1', 'Oui'], ['0', 'Non']];
        row('Son', onOff, () => (settings.sound ? '1' : '0'), (v) => (settings.sound = v === '1'));
        row('Vibration', onOff, () => (settings.vibration ? '1' : '0'), (v) => (settings.vibration = v === '1'));
        row('Qualité', [['auto', 'Auto'], ['high', 'Haute'], ['low', 'Basse']], () => settings.quality, (v) => { settings.quality = v as Quality; this.onQuality(); });
        btn('Retour', () => this.show(this.back));
        break;
      }
      case 'pause': {
        html('<h2>Pause</h2>');
        html(`<div class="stats"><div><b>${g.score}</b>Score</div><div><b>${g.levelIndex + 1}</b>Niveau</div><div><b>${g.lives}</b>Vies</div></div>`);
        btn('Reprendre', () => g.resume(), true);
        btn('Recommencer le niveau', () => { g.newGame(g.levelIndex); });
        btn('Réglages', () => { this.back = 'pause'; this.show('settings'); });
        btn('Menu principal', () => g.toMenu());
        break;
      }
      case 'levelclear': {
        html(`<h2>Niveau ${g.levelIndex + 1} terminé !</h2><p class="sub">${g.levelName}</p>`);
        html(`<div class="stats"><div><b>${g.score}</b>Score</div><div><b>×${Math.min(8, 1 + Math.floor(g.bestCombo / 4))}</b>Meilleur combo</div></div>`);
        if (g.newBest) html('<p class="sub" style="color:var(--accent)">Nouveau record !</p>');
        btn('Niveau suivant', () => g.nextLevel(), true);
        btn('Menu principal', () => g.toMenu());
        break;
      }
      case 'gameover': {
        html('<h2>Partie terminée</h2>');
        html(`<div class="stats"><div><b>${g.score}</b>Score</div><div><b>${progress.best}</b>Record</div></div>`);
        if (g.newBest) html('<p class="sub" style="color:var(--accent)">Nouveau record !</p>');
        btn('Rejouer ce niveau', () => this.startLevel(g.levelIndex), true);
        btn('Menu principal', () => g.toMenu());
        break;
      }
    }
  }
}
