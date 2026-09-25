/** Constantes de jeu (unités monde : largeur logique fixe de 400). */
export const WORLD_W = 400;
export const MIN_WORLD_H = 620;
export const PHYS_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export const COLS = 10;
export const BRICK_MARGIN = 8;
export const BRICK_GAP = 3;
export const BRICK_W = (WORLD_W - BRICK_MARGIN * 2 - BRICK_GAP * (COLS - 1)) / COLS;
export const BRICK_H = 17;
export const HUD_H = 46;

export const BALL_R = 6.5;
export const BALL_SPEED_START = 340;
export const BALL_SPEED_MAX = 600;
export const BALL_SPEED_GAIN = 4; // px/s gagnés par seconde de jeu
export const MAX_BOUNCE_ANGLE = (65 * Math.PI) / 180;
export const MIN_VY_RATIO = 0.28;
export const MAX_BALLS = 12;

export const PADDLE_W = 76;
export const PADDLE_H = 13;
export const PADDLE_BOTTOM_ZONE = 110; // hauteur de zone tactile sous la raquette

export const POWERUP_CHANCE = 0.13;
export const POWERUP_SPEED = 130;
export const POWERUP_DURATION = 12;
export const LASER_INTERVAL = 0.32;
export const LASER_SPEED = 720;

export const GRAVITY = 980;
export const LIVES = 3;
