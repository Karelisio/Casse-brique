import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { MIN_WORLD_H, WORLD_W } from './engine/config';
import { Game } from './engine/Game';
import { Loop } from './engine/Loop';
import { settings } from './engine/Settings';
import { Input } from './input/Input';
import { Renderer } from './render/Renderer';
import { Menu } from './ui/Menu';
import { audio } from './audio/Audio';
import { isNative, lockPortrait, onLifecycle } from './platform/native';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

// échelle monde → CSS px
let scale = 1;
let offXCss = 0;

const renderer = new Renderer(canvas);
let game!: Game;
const input = new Input(
  canvas,
  (clientX) => (clientX - offXCss) / scale,
  () => scale,
  () => game.paddle.x,
);
game = new Game(input);

// ---------- qualité ----------
let autoLow = false;
function isLow(): boolean {
  return settings.quality === 'low' || (settings.quality === 'auto' && autoLow);
}
function applyQuality(): void {
  const low = isLow();
  renderer.lowQ = low;
  game.lowQ = low;
  game.fx.setQuality(low);
  resize();
}

// ---------- safe areas ----------
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0';
document.body.appendChild(probe);

function resize(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cs = getComputedStyle(probe);
  const sat = parseFloat(cs.paddingTop) || 0;
  const sab = parseFloat(cs.paddingBottom) || 0;
  scale = vw / WORLD_W;
  let worldH = vh / scale;
  if (worldH < MIN_WORLD_H) {
    scale = vh / MIN_WORLD_H;
    worldH = MIN_WORLD_H;
  }
  offXCss = (vw - WORLD_W * scale) / 2;
  const dpr = Math.min(window.devicePixelRatio || 1, isLow() ? 1.5 : 3);
  renderer.resize(Math.round(vw * dpr), Math.round(vh * dpr), scale * dpr, offXCss * dpr, worldH);
  game.layout(worldH, sat / scale, sab / scale);
}

let resizeTimer = 0;
const onResize = (): void => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 60); };
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
screen.orientation?.addEventListener?.('change', onResize);

// ---------- UI / entrées ----------
const menu = new Menu(uiRoot, game, applyQuality);
input.onRelease = () => game.launch();
input.onPause = () => (game.state === 'paused' ? game.resume() : game.pause());

onLifecycle(
  () => { game.pause(); audio.suspend(); },
  () => menu.handleBack(),
);
document.addEventListener('visibilitychange', () => { if (!document.hidden) audio.unlock(); });

// ---------- boucle ----------
let lowFrames = 0;
const loop = new Loop(
  (dt) => game.step(dt),
  (alpha) => {
    renderer.render(game, alpha);
    // qualité auto : bascule en basse si < 45 fps soutenu pendant le jeu
    if (settings.quality === 'auto' && !autoLow && game.state === 'playing') {
      lowFrames = loop.fps < 45 ? lowFrames + 1 : Math.max(0, lowFrames - 2);
      if (lowFrames > 120) { autoLow = true; applyQuality(); }
    }
  },
);

resize();
applyQuality();
game.loadLevel(0); // décor du menu
game.toMenu();
loop.start();
if (isNative) lockPortrait();

// ---------- PWA ----------
if ('serviceWorker' in navigator && !isNative && import.meta.env.PROD) {
  registerSW({ immediate: true });
}

// accès debug / tests
(window as unknown as { __game: Game }).__game = game;
