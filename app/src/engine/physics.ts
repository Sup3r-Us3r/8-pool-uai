// ============================================================
// Client-side 2D Physics Engine with Sub-stepping & 3D Rolling
// ============================================================

import type { BallState, Vec2 } from '../types';
import {
  BALL_RADIUS,
  BALL_DIAMETER,
  FRICTION,
  MIN_VELOCITY,
  CUSHION_RESTITUTION,
  BALL_RESTITUTION,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  POCKET_POSITIONS,
  POCKET_RADIUS,
  MAX_SHOT_POWER,
} from './constants';

// --- Vector helpers ---

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function dist(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

// --- Mutable ball for simulation ---

export interface SimBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  rotX: number; // 3D rotation around X axis (radians)
  rotY: number; // 3D rotation around Y axis (radians)
  rotAngle: number; // visual rolling angle
}

/**
 * Convert server BallState to mutable SimBall.
 */
export function toSimBalls(balls: BallState[]): SimBall[] {
  return balls.map((b) => ({
    id: b.id,
    x: b.position.x,
    y: b.position.y,
    vx: b.velocity.x,
    vy: b.velocity.y,
    pocketed: b.pocketed,
    rotX: 0,
    rotY: 0,
    rotAngle: 0,
  }));
}

/**
 * Apply a shot to the cue ball.
 */
export function applyShot(balls: SimBall[], angle: number, power: number): void {
  const speed = power * MAX_SHOT_POWER;
  const cue = balls.find((b) => b.id === 0);
  if (cue && !cue.pocketed) {
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;
  }
}

const SUB_STEPS = 8;
const SUB_DT = 1.0 / SUB_STEPS;
const SUB_FRICTION = Math.pow(FRICTION, 1.0 / SUB_STEPS);

/**
 * Run one physics step with 8 sub-steps for smooth, collision-accurate animation.
 * Returns true if any ball is still moving.
 */
export function physicsStep(balls: SimBall[]): boolean {
  let anyMoving = false;

  for (let sub = 0; sub < SUB_STEPS; sub++) {
    // 1. Position & 3D rotation update
    for (const b of balls) {
      if (b.pocketed) continue;
      const speedSq = b.vx * b.vx + b.vy * b.vy;
      if (speedSq > MIN_VELOCITY * MIN_VELOCITY) {
        anyMoving = true;
        const dx = b.vx * SUB_DT;
        const dy = b.vy * SUB_DT;
        b.x += dx;
        b.y += dy;

        // 3D Ball Rotation Integration
        const distMoved = Math.sqrt(dx * dx + dy * dy);
        if (distMoved > 0.001) {
          const dAngle = distMoved / BALL_RADIUS;
          b.rotAngle += dAngle;
          const speed = Math.sqrt(speedSq);
          b.rotX += (b.vy / speed) * dAngle;
          b.rotY += (b.vx / speed) * dAngle;
        }
      }
    }

    // 2. Ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].pocketed) continue;
        resolveBallCollision(balls[i], balls[j]);
      }
    }

    // 3. Cushion collisions
    for (const b of balls) {
      if (b.pocketed) continue;
      resolveWallCollision(b);
    }

    // 4. Pocket detection & Funneling
    for (const b of balls) {
      if (b.pocketed) continue;
      
      // Funnel near pocket
      for (const p of POCKET_POSITIONS) {
        const pdx = p.x - b.x;
        const pdy = p.y - b.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < POCKET_RADIUS) {
          b.pocketed = true;
          b.vx = 0;
          b.vy = 0;
          break;
        } else if (pdist < POCKET_RADIUS * 1.35) {
          b.vx += (pdx / pdist) * 0.3;
          b.vy += (pdy / pdist) * 0.3;
        }
      }
    }

    // 5. Apply friction
    for (const b of balls) {
      if (b.pocketed) continue;
      b.vx *= SUB_FRICTION;
      b.vy *= SUB_FRICTION;
      if (b.vx * b.vx + b.vy * b.vy < MIN_VELOCITY * MIN_VELOCITY) {
        b.vx = 0;
        b.vy = 0;
      }
    }
  }

  return anyMoving;
}

function resolveBallCollision(a: SimBall, b: SimBall): void {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > BALL_DIAMETER || d < 1e-10) return;

  const nx = dx / d;
  const ny = dy / d;

  // Separate overlapping balls
  const overlap = BALL_DIAMETER - d;
  const sep = overlap / 2;
  a.x += nx * sep;
  a.y += ny * sep;
  b.x -= nx * sep;
  b.y -= ny * sep;

  // Relative velocity along normal
  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const velNormal = dvx * nx + dvy * ny;

  if (velNormal > 0) return;

  const impulseX = nx * velNormal * BALL_RESTITUTION;
  const impulseY = ny * velNormal * BALL_RESTITUTION;

  a.vx -= impulseX;
  a.vy -= impulseY;
  b.vx += impulseX;
  b.vy += impulseY;
}

function resolveWallCollision(b: SimBall): void {
  if (b.x - BALL_RADIUS < 0) {
    b.x = BALL_RADIUS;
    b.vx = -b.vx * CUSHION_RESTITUTION;
  }
  if (b.x + BALL_RADIUS > TABLE_WIDTH) {
    b.x = TABLE_WIDTH - BALL_RADIUS;
    b.vx = -b.vx * CUSHION_RESTITUTION;
  }
  if (b.y - BALL_RADIUS < 0) {
    b.y = BALL_RADIUS;
    b.vy = -b.vy * CUSHION_RESTITUTION;
  }
  if (b.y + BALL_RADIUS > TABLE_HEIGHT) {
    b.y = TABLE_HEIGHT - BALL_RADIUS;
    b.vy = -b.vy * CUSHION_RESTITUTION;
  }
}

export interface AimTrajectoryResult {
  endpoint: Vec2;
  ghostBall: Vec2 | null;
  hitBall: SimBall | null;
  targetTrajectory: { start: Vec2; end: Vec2; dir: Vec2 } | null;
  cueDeflection: { start: Vec2; end: Vec2; dir: Vec2 } | null;
  cushionReflection: { start: Vec2; end: Vec2 } | null;
}

/**
 * High-precision 8 Ball Pool Aim Trajectory Engine.
 * Calculates exact ghost ball impact point, target ball trajectory, cue ball tangent deflection, and cushion bounce.
 */
export function getAimTrajectory(
  cueBall: SimBall,
  angle: number,
  balls: SimBall[]
): AimTrajectoryResult {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  let closestDist = Infinity;
  let closestBall: SimBall | null = null;
  let ghostPos: Vec2 | null = null;

  const cuePos = { x: cueBall.x, y: cueBall.y };

  // 1. Ray-Circle intersection with all active object balls
  for (const b of balls) {
    if (b.id === 0 || b.pocketed) continue;

    const vx = b.x - cuePos.x;
    const vy = b.y - cuePos.y;

    const proj = vx * dirX + vy * dirY;
    if (proj <= 0) continue;

    const perpSq = vx * vx + vy * vy - proj * proj;
    const hitRadiusSq = BALL_DIAMETER * BALL_DIAMETER;

    if (perpSq < hitRadiusSq) {
      const dHit = proj - Math.sqrt(hitRadiusSq - perpSq);
      if (dHit > 0 && dHit < closestDist) {
        closestDist = dHit;
        closestBall = b;
        ghostPos = {
          x: cuePos.x + dirX * dHit,
          y: cuePos.y + dirY * dHit,
        };
      }
    }
  }

  // 2. Check cushion collision distance
  let wallDist = Infinity;
  let wallHitPos: Vec2 | null = null;
  let wallNormal: Vec2 = { x: 0, y: 0 };

  if (dirX > 0) {
    const d = (TABLE_WIDTH - BALL_RADIUS - cuePos.x) / dirX;
    if (d < wallDist) {
      wallDist = d;
      wallHitPos = { x: TABLE_WIDTH - BALL_RADIUS, y: cuePos.y + dirY * d };
      wallNormal = { x: -1, y: 0 };
    }
  } else if (dirX < 0) {
    const d = (BALL_RADIUS - cuePos.x) / dirX;
    if (d < wallDist) {
      wallDist = d;
      wallHitPos = { x: BALL_RADIUS, y: cuePos.y + dirY * d };
      wallNormal = { x: 1, y: 0 };
    }
  }

  if (dirY > 0) {
    const d = (TABLE_HEIGHT - BALL_RADIUS - cuePos.y) / dirY;
    if (d < wallDist) {
      wallDist = d;
      wallHitPos = { x: cuePos.x + dirX * d, y: TABLE_HEIGHT - BALL_RADIUS };
      wallNormal = { x: 0, y: -1 };
    }
  } else if (dirY < 0) {
    const d = (BALL_RADIUS - cuePos.y) / dirY;
    if (d < wallDist) {
      wallDist = d;
      wallHitPos = { x: cuePos.x + dirX * d, y: BALL_RADIUS };
      wallNormal = { x: 0, y: 1 };
    }
  }

  // 3. Build trajectory result
  if (closestBall && ghostPos && closestDist < wallDist) {
    const targetStart = { x: closestBall.x, y: closestBall.y };
    const tdx = closestBall.x - ghostPos.x;
    const tdy = closestBall.y - ghostPos.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const targetDir = { x: tdx / tlen, y: tdy / tlen };

    const targetLineLength = 240;
    const targetEnd = {
      x: targetStart.x + targetDir.x * targetLineLength,
      y: targetStart.y + targetDir.y * targetLineLength,
    };

    const dot = dirX * targetDir.x + dirY * targetDir.y;
    const cdx = dirX - dot * targetDir.x;
    const cdy = dirY - dot * targetDir.y;
    const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
    const cueDir = { x: cdx / clen, y: cdy / clen };

    const cueLineLength = 120;
    const cueEnd = {
      x: ghostPos.x + cueDir.x * cueLineLength,
      y: ghostPos.y + cueDir.y * cueLineLength,
    };

    return {
      endpoint: ghostPos,
      ghostBall: ghostPos,
      hitBall: closestBall,
      targetTrajectory: { start: targetStart, end: targetEnd, dir: targetDir },
      cueDeflection: { start: ghostPos, end: cueEnd, dir: cueDir },
      cushionReflection: null,
    };
  }

  if (wallHitPos) {
    const dotN = dirX * wallNormal.x + dirY * wallNormal.y;
    const rx = dirX - 2 * dotN * wallNormal.x;
    const ry = dirY - 2 * dotN * wallNormal.y;
    const refLen = 180;
    const refEnd = {
      x: wallHitPos.x + rx * refLen,
      y: wallHitPos.y + ry * refLen,
    };

    return {
      endpoint: wallHitPos,
      ghostBall: null,
      hitBall: null,
      targetTrajectory: null,
      cueDeflection: null,
      cushionReflection: { start: wallHitPos, end: refEnd },
    };
  }

  const defaultEnd = { x: cuePos.x + dirX * 600, y: cuePos.y + dirY * 600 };
  return {
    endpoint: defaultEnd,
    ghostBall: null,
    hitBall: null,
    targetTrajectory: null,
    cueDeflection: null,
    cushionReflection: null,
  };
}
