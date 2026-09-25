import { settings } from '../engine/Settings';
import type { MaterialId } from '../entities/materials';

/**
 * Synthèse sonore procédurale (Web Audio) : aucun fichier audio.
 * Chaque matériau a sa signature : verre = partiels aigus cristallins,
 * bois = bruit filtré passe-bande court, pierre = bruit grave, métal = partiels inharmoniques.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private voices = 0;

  /** À appeler depuis un geste utilisateur (déblocage iOS/Chrome). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  suspend(): void { this.ctx?.suspend().catch(() => {}); }

  private ok(): AudioContext | null {
    if (!settings.sound || !this.ctx || this.ctx.state !== 'running') return null;
    if (this.voices > 24) return null;
    return this.ctx;
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => this.voices--;
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 1, delay = 0): void {
    const c = this.ok(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
    this.track(o);
  }

  private burst(dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, delay = 0, freqEnd?: number): void {
    const c = this.ok(); if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5, dur + 0.05);
    this.track(s);
  }

  hit(mat: MaterialId, strength = 1): void {
    const v = Math.min(1, 0.4 + strength * 0.6);
    const p = 0.94 + Math.random() * 0.12;
    switch (mat) {
      case 'glass':
        this.tone(2100 * p, 0.18, 0.18 * v); this.tone(3350 * p, 0.12, 0.08 * v);
        this.burst(0.04, 0.12 * v, 'highpass', 4000); break;
      case 'wood':
        this.burst(0.07, 0.5 * v, 'bandpass', 700 * p, 3); this.tone(220 * p, 0.08, 0.25 * v, 'triangle', 0.7); break;
      case 'stone':
        this.burst(0.1, 0.55 * v, 'lowpass', 900 * p, 1); this.tone(120 * p, 0.09, 0.3 * v, 'sine', 0.6); break;
      case 'metal':
      case 'steel':
        for (const r of [1, 2.76, 5.4, 8.93]) this.tone(520 * p * r, 0.35 / Math.sqrt(r), 0.09 * v / Math.sqrt(r), 'sine');
        this.burst(0.03, 0.25 * v, 'highpass', 3000); break;
      case 'explosive':
        this.tone(300 * p, 0.08, 0.2 * v, 'square', 0.5); break;
    }
  }

  breakSound(mat: MaterialId): void {
    const p = 0.92 + Math.random() * 0.16;
    switch (mat) {
      case 'glass':
        for (let i = 0; i < 5; i++) this.tone((2500 + Math.random() * 3000) * p, 0.15 + Math.random() * 0.2, 0.07, 'sine', 1, i * 0.018);
        this.burst(0.25, 0.3, 'highpass', 3500, 0.7); break;
      case 'wood':
        this.burst(0.18, 0.6, 'bandpass', 500 * p, 2, 0, 250); this.burst(0.06, 0.4, 'bandpass', 1400, 4, 0.03); break;
      case 'stone':
        this.burst(0.35, 0.7, 'lowpass', 1200 * p, 0.8, 0, 200); this.tone(70, 0.25, 0.35, 'sine', 0.5); break;
      case 'metal':
        for (const r of [1, 2.3, 3.9]) this.tone(380 * p * r, 0.6, 0.08, 'triangle', 0.97);
        this.burst(0.2, 0.3, 'bandpass', 2500, 2); break;
      default: break;
    }
  }

  explosion(): void {
    this.burst(0.8, 0.9, 'lowpass', 1800, 0.7, 0, 60);
    this.tone(90, 0.5, 0.6, 'sine', 0.35);
    this.burst(0.15, 0.4, 'highpass', 2500, 0.5);
  }
  paddle(strength = 1): void {
    this.tone(180, 0.1, 0.3 * strength, 'triangle', 0.75);
    this.burst(0.03, 0.15, 'bandpass', 1800, 2);
  }
  wall(): void { this.tone(140, 0.05, 0.12, 'triangle', 0.8); }
  laser(): void { this.tone(1400, 0.09, 0.07, 'sawtooth', 0.4); }
  powerup(): void { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 0.14, 'triangle', 1, i * 0.055)); }
  lose(): void { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 0.18, 'triangle', 0.97, i * 0.11)); }
  win(): void { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 0.14, 'sine', 1, i * 0.08)); }
  click(): void { this.tone(900, 0.04, 0.08, 'triangle'); }
}

export const audio = new AudioEngine();
