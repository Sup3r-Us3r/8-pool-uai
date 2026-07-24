// ============================================================
// Game constants — dimensions, colors, physics parameters
// ============================================================

// --- Table dimensions (match server) ---
export const TABLE_WIDTH = 1040;
export const TABLE_HEIGHT = 520;

// --- Visual offsets (for drawing borders, cushions) ---
export const RAIL_WIDTH = 34;
export const CANVAS_WIDTH = TABLE_WIDTH + RAIL_WIDTH * 2;
export const CANVAS_HEIGHT = TABLE_HEIGHT + RAIL_WIDTH * 2;

// --- Ball ---
export const BALL_RADIUS = 12;
export const BALL_DIAMETER = BALL_RADIUS * 2;

// --- Pockets ---
export const POCKET_RADIUS = 22;
export const POCKET_VISUAL_RADIUS = 26;

export const POCKET_POSITIONS = [
  { x: 0, y: 0 },                          // top-left
  { x: TABLE_WIDTH / 2, y: -5 },           // top-center
  { x: TABLE_WIDTH, y: 0 },                // top-right
  { x: 0, y: TABLE_HEIGHT },               // bottom-left
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT + 5 }, // bottom-center
  { x: TABLE_WIDTH, y: TABLE_HEIGHT },      // bottom-right
];

// --- Physics (client-side animation) ---
export const FRICTION = 0.985;
export const MIN_VELOCITY = 0.15;
export const MAX_SHOT_POWER = 25;
export const CUSHION_RESTITUTION = 0.75;
export const BALL_RESTITUTION = 0.96;

// --- Shot ---
export const MAX_POWER = 1.0;
export const TURN_TIMER_SECONDS = 30;

// --- Ball colors ---
export const BALL_COLORS: Record<number, { fill: string; isStripe: boolean }> = {
  0:  { fill: '#FFFFFF', isStripe: false }, // cue ball (white)
  1:  { fill: '#FFD700', isStripe: false }, // yellow
  2:  { fill: '#0066CC', isStripe: false }, // blue
  3:  { fill: '#CC0000', isStripe: false }, // red
  4:  { fill: '#4B0082', isStripe: false }, // purple
  5:  { fill: '#FF6600', isStripe: false }, // orange
  6:  { fill: '#006633', isStripe: false }, // green
  7:  { fill: '#800000', isStripe: false }, // maroon
  8:  { fill: '#1A1A1A', isStripe: false }, // 8 ball (black)
  9:  { fill: '#FFD700', isStripe: true },  // yellow stripe
  10: { fill: '#0066CC', isStripe: true },  // blue stripe
  11: { fill: '#CC0000', isStripe: true },  // red stripe
  12: { fill: '#4B0082', isStripe: true },  // purple stripe
  13: { fill: '#FF6600', isStripe: true },  // orange stripe
  14: { fill: '#006633', isStripe: true },  // green stripe
  15: { fill: '#800000', isStripe: true },  // maroon stripe
};

// --- Table visual colors ---
export const FELT_COLOR = '#0d5c2e';
export const FELT_COLOR_DARK = '#094a24';
export const RAIL_COLOR = '#5C3317';
export const RAIL_HIGHLIGHT = '#7B4B2A';
export const RAIL_SHADOW = '#3D200F';
export const POCKET_COLOR = '#111111';
export const CUE_COLOR = '#D4A76A';
export const CUE_TIP_COLOR = '#3B7DD8';
export const AIM_LINE_COLOR = 'rgba(255, 255, 255, 0.35)';
export const POWER_BAR_BG = 'rgba(0, 0, 0, 0.5)';
