// ============================================================
// Canvas 2D Renderer — High-fidelity pool table rendering
// ============================================================

import type { SimBall } from './physics';
import {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  RAIL_WIDTH,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  POCKET_POSITIONS,
  POCKET_VISUAL_RADIUS,
  BALL_COLORS,
  FELT_COLOR,
  FELT_COLOR_DARK,
  RAIL_COLOR,
  RAIL_HIGHLIGHT,
  RAIL_SHADOW,
  POCKET_COLOR,
  CUE_COLOR,
  CUE_TIP_COLOR,
  AIM_LINE_COLOR,
} from './constants';

/**
 * Draw the full pool table background (felt, rails, pockets).
 */
export function drawTable(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;

  // --- Outer background ---
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, w, h);

  // --- Rails (wood border) ---
  const rw = RAIL_WIDTH;

  // Outer rail gradient
  const railGrad = ctx.createLinearGradient(0, 0, 0, h);
  railGrad.addColorStop(0, RAIL_HIGHLIGHT);
  railGrad.addColorStop(0.5, RAIL_COLOR);
  railGrad.addColorStop(1, RAIL_SHADOW);
  ctx.fillStyle = railGrad;
  ctx.fillRect(0, 0, w, h);

  // Inner shadow on rail
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rw - 1, rw - 1, TABLE_WIDTH + 2, TABLE_HEIGHT + 2);

  // --- Felt (playing area) ---
  const feltGrad = ctx.createRadialGradient(
    rw + TABLE_WIDTH / 2, rw + TABLE_HEIGHT / 2, 50,
    rw + TABLE_WIDTH / 2, rw + TABLE_HEIGHT / 2, TABLE_WIDTH / 1.5
  );
  feltGrad.addColorStop(0, FELT_COLOR);
  feltGrad.addColorStop(1, FELT_COLOR_DARK);
  ctx.fillStyle = feltGrad;
  ctx.fillRect(rw, rw, TABLE_WIDTH, TABLE_HEIGHT);

  // Felt texture (subtle noise pattern)
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 200; i++) {
    const x = rw + Math.random() * TABLE_WIDTH;
    const y = rw + Math.random() * TABLE_HEIGHT;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1.0;

  // --- Head string line (quarter mark) ---
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  const headX = rw + TABLE_WIDTH * 0.25;
  ctx.beginPath();
  ctx.moveTo(headX, rw + 10);
  ctx.lineTo(headX, rw + TABLE_HEIGHT - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- Foot spot (where 8-ball sits in rack) ---
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(rw + TABLE_WIDTH * 0.73, rw + TABLE_HEIGHT / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // --- Pockets ---
  for (const p of POCKET_POSITIONS) {
    const px = rw + p.x;
    const py = rw + p.y;

    // Pocket hole shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(px, py, POCKET_VISUAL_RADIUS + 4, 0, Math.PI * 2);
    ctx.fill();

    // Pocket hole
    const pocketGrad = ctx.createRadialGradient(px, py, 0, px, py, POCKET_VISUAL_RADIUS);
    pocketGrad.addColorStop(0, '#000000');
    pocketGrad.addColorStop(0.7, '#0a0a0a');
    pocketGrad.addColorStop(1, POCKET_COLOR);
    ctx.fillStyle = pocketGrad;
    ctx.beginPath();
    ctx.arc(px, py, POCKET_VISUAL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Pocket rim
    ctx.strokeStyle = 'rgba(80, 50, 20, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, POCKET_VISUAL_RADIUS + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Diamond markers on rails ---
  ctx.fillStyle = 'rgba(255, 215, 100, 0.5)';
  // Top and bottom rails
  for (let i = 1; i <= 3; i++) {
    const x1 = rw + (TABLE_WIDTH / 4) * i;
    // Top
    ctx.beginPath();
    ctx.arc(x1, rw / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Bottom
    ctx.beginPath();
    ctx.arc(x1, rw + TABLE_HEIGHT + rw / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Left and right rails
  for (let i = 1; i <= 3; i++) {
    const y1 = rw + (TABLE_HEIGHT / 4) * i;
    // Left
    ctx.beginPath();
    ctx.arc(rw / 2, y1, 3, 0, Math.PI * 2);
    ctx.fill();
    // Right
    ctx.beginPath();
    ctx.arc(rw + TABLE_WIDTH + rw / 2, y1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a single pool ball with realistic shading and number.
 */
export function drawBall(ctx: CanvasRenderingContext2D, ball: SimBall): void {
  if (ball.pocketed) return;

  const x = RAIL_WIDTH + ball.x;
  const y = RAIL_WIDTH + ball.y;
  const r = BALL_RADIUS;
  const colorInfo = BALL_COLORS[ball.id];
  if (!colorInfo) return;

  ctx.save();

  // Dynamic shadow based on velocity
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const shadowOffsetX = 2 + (ball.vx / (speed || 1)) * Math.min(speed * 0.2, 3);
  const shadowOffsetY = 3 + (ball.vy / (speed || 1)) * Math.min(speed * 0.2, 3);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x + shadowOffsetX, y + shadowOffsetY, r * 0.95, r * 0.55, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();

  // --- Base sphere ---
  if (colorInfo.isStripe) {
    // White base for stripe ball
    ctx.fillStyle = '#F8F9FA';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Colored stripe band (Rotated based on 3D rolling angle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(x, y);
    const stripeAngle = (ball.rotAngle || 0) + (ball.rotX || 0) * 0.5;
    ctx.rotate(stripeAngle);

    ctx.fillStyle = colorInfo.fill;
    const stripeHeight = r * 0.95;
    ctx.fillRect(-r * 1.2, -stripeHeight / 2, r * 2.4, stripeHeight);

    ctx.restore();
  } else {
    // Solid ball
    ctx.fillStyle = colorInfo.fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Rotated Number Badge (or Dot for Cue Ball) ---
  ctx.save();
  ctx.translate(x, y);
  const numAngle = (ball.rotAngle || 0) + (ball.rotY || 0) * 0.5;
  ctx.rotate(numAngle);

  if (ball.id !== 0) {
    // White circle for number
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Number text
    ctx.fillStyle = '#111111';
    ctx.font = `900 ${r * 0.65}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ball.id), 0, 0.5);
  } else {
    // Red dot on cue ball (spin marker)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- Fixed 3D Specular Highlight (Light reflection stays fixed on top) ---
  const hlGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  hlGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
  hlGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
  hlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');

  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Edge outline
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw the cue stick pointing from the cue ball at a given angle.
 */
export function drawCue(
  ctx: CanvasRenderingContext2D,
  cueBall: SimBall,
  angle: number,
  power: number
): void {
  if (cueBall.pocketed) return;

  const cx = RAIL_WIDTH + cueBall.x;
  const cy = RAIL_WIDTH + cueBall.y;

  // Distance from ball center to cue tip based on power (pull back)
  const pullBack = 15 + power * 80;
  const cueLength = 220;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI); // point away from shot direction

  // Cue shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(pullBack + 3, 3);
  ctx.lineTo(pullBack + cueLength + 3, 3);
  ctx.stroke();

  // Cue body gradient
  const cueGrad = ctx.createLinearGradient(pullBack, 0, pullBack + cueLength, 0);
  cueGrad.addColorStop(0, CUE_TIP_COLOR);
  cueGrad.addColorStop(0.02, '#F5DEB3');
  cueGrad.addColorStop(0.05, CUE_COLOR);
  cueGrad.addColorStop(0.7, '#C49A5C');
  cueGrad.addColorStop(1, '#2C1A0A');

  ctx.strokeStyle = cueGrad;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pullBack, 0);
  ctx.lineTo(pullBack + cueLength, 0);
  ctx.stroke();

  // Cue tip highlight
  ctx.fillStyle = CUE_TIP_COLOR;
  ctx.beginPath();
  ctx.arc(pullBack, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw the aim line from the cue ball in the shot direction.
 */
export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  cueBall: SimBall,
  _angle: number,
  endpoint: { x: number; y: number },
  hitBallId: number | null
): void {
  if (cueBall.pocketed) return;

  const cx = RAIL_WIDTH + cueBall.x;
  const cy = RAIL_WIDTH + cueBall.y;
  const ex = RAIL_WIDTH + endpoint.x;
  const ey = RAIL_WIDTH + endpoint.y;

  ctx.save();
  ctx.strokeStyle = AIM_LINE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.setLineDash([]);

  // Ghost ball at endpoint
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ex, ey, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // If hitting a ball, show projected direction
  if (hitBallId !== null) {
    ctx.fillStyle = 'rgba(255,100,100,0.4)';
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw the power bar on the right side of the canvas.
 */
export function drawPowerBar(
  ctx: CanvasRenderingContext2D,
  power: number,
  canvasHeight: number
): void {
  const barWidth = 18;
  const barHeight = canvasHeight - 60;
  const x = CANVAS_WIDTH - 15;
  const y = 30;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(x - barWidth / 2 - 3, y - 3, barWidth + 6, barHeight + 6, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - barWidth / 2 - 3, y - 3, barWidth + 6, barHeight + 6, 6);
  ctx.stroke();

  // Filled portion (bottom up)
  const fillHeight = barHeight * power;
  const powerGrad = ctx.createLinearGradient(x, y + barHeight, x, y + barHeight - fillHeight);
  powerGrad.addColorStop(0, '#22C55E');
  powerGrad.addColorStop(0.5, '#EAB308');
  powerGrad.addColorStop(1, '#EF4444');

  ctx.fillStyle = powerGrad;
  ctx.beginPath();
  ctx.roundRect(x - barWidth / 2, y + barHeight - fillHeight, barWidth, fillHeight, 3);
  ctx.fill();

  // Glow effect
  if (power > 0.1) {
    ctx.shadowColor = power > 0.7 ? '#EF4444' : '#22C55E';
    ctx.shadowBlur = 10;
    ctx.fillStyle = powerGrad;
    ctx.beginPath();
    ctx.roundRect(x - barWidth / 2, y + barHeight - fillHeight, barWidth, fillHeight, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(power * 100)}%`, x, y + barHeight + 16);

  ctx.restore();
}

/**
 * Draw "ball in hand" indicator — a translucent cue ball following the cursor.
 */
export function drawBallInHand(
  ctx: CanvasRenderingContext2D,
  mouseX: number,
  mouseY: number,
  isValid: boolean
): void {
  const x = mouseX;
  const y = mouseY;

  ctx.save();
  ctx.globalAlpha = 0.6;

  // Ghost cue ball
  ctx.fillStyle = isValid ? '#FFFFFF' : '#FF4444';
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isValid ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();
}
