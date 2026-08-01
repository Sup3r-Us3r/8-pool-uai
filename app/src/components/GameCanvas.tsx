// ============================================================
// GameCanvas — Canvas 2D pool table with 8-Ball Pool controls & geometric aim
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, RoomInfo, ShootParams } from '../types';
import {
  type SimBall,
  toSimBalls,
  applyShot,
  physicsStep,
  getAimTrajectory,
} from '../engine/physics';
import {
  drawTable,
  drawBall,
  drawCue,
  drawAimLine,
  drawPowerBar,
  drawBallInHand,
} from '../engine/renderer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RAIL_WIDTH,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  BALL_DIAMETER,
} from '../engine/constants';

interface GameCanvasProps {
  gameState: GameState;
  roomInfo: RoomInfo;
  onShoot: (params: ShootParams) => void;
  onPlaceCueBall: (x: number, y: number) => void;
}

export function GameCanvas({ gameState, roomInfo, onShoot, onPlaceCueBall }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simBallsRef = useRef<SimBall[]>([]);
  const pendingSyncRef = useRef<SimBall[] | null>(null);
  const animatingRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [power, setPower] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const angleRef = useRef(0);
  const initialAngleRef = useRef(0);
  const frameIdRef = useRef(0);
  const lastShotTimestampRef = useRef<number>(0);

  const myId = roomInfo.playerId;
  const isMyTurn = gameState.activePlayerId === myId;
  const ballInHand = gameState.ballInHand && isMyTurn;

  // Handle SHOT_STARTED event from server
  useEffect(() => {
    if (gameState.lastShotStart && gameState.lastShotStart.timestamp > lastShotTimestampRef.current) {
      lastShotTimestampRef.current = gameState.lastShotStart.timestamp;
      const { angle, power: shotPower } = gameState.lastShotStart;

      animatingRef.current = true;
      applyShot(simBallsRef.current, angle, shotPower);
    }
  }, [gameState.lastShotStart]);

  // Sync server balls to local sim balls when shot animation finishes
  useEffect(() => {
    if (gameState.balls.length > 0) {
      const newSim = toSimBalls(gameState.balls);
      pendingSyncRef.current = newSim;

      if (!animatingRef.current) {
        simBallsRef.current = newSim;
      }
    }
  }, [gameState.balls]);

  // Helper to compute absolute angular distance in [0, PI]
  const getAngleDiff = (a1: number, a2: number) => {
    let diff = a1 - a2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff);
  };

  // Calculate angle from cue ball to mouse, allowing dynamic angle adjustment during drag
  const getAngle = useCallback(() => {
    const cueBall = simBallsRef.current.find((b) => b.id === 0);
    if (!cueBall || cueBall.pocketed) return angleRef.current;

    const cx = RAIL_WIDTH + cueBall.x;
    const cy = RAIL_WIDTH + cueBall.y;
    const dx = mouseRef.current.x - cx;
    const dy = mouseRef.current.y - cy;

    if (Math.hypot(dx, dy) < 2) return angleRef.current;

    let angle = Math.atan2(dy, dx);

    if (isDragging) {
      // If mouse position relative to cue ball is opposite to initial aim direction (>90 deg diff),
      // adjust angle by 180 deg so pulling back doesn't invert the shot trajectory
      if (getAngleDiff(angle, initialAngleRef.current) > Math.PI / 2) {
        angle += Math.PI;
      }
    }

    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }, [isDragging]);

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };

      if (isMyTurn && !animatingRef.current && !ballInHand) {
        angleRef.current = getAngle();

        if (isDragging) {
          // Power calculation from drag distance
          const dx = mouseRef.current.x - dragStartRef.current.x;
          const dy = mouseRef.current.y - dragStartRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const newPower = Math.min(dist / 220, 1);
          setPower(newPower);
        }
      }
    },
    [isDragging, isMyTurn, ballInHand, getAngle]
  );

  // Mouse wheel handler for precision micro-aiming
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!isMyTurn || animatingRef.current || ballInHand) return;
      // Adjust angle in small steps
      const delta = Math.sign(e.deltaY) * 0.005;
      angleRef.current += delta;
      if (angleRef.current > Math.PI) angleRef.current -= Math.PI * 2;
      if (angleRef.current < -Math.PI) angleRef.current += Math.PI * 2;
    },
    [isMyTurn, ballInHand]
  );

  // Mouse down handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isMyTurn || animatingRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      if (ballInHand) {
        const tableX = mx - RAIL_WIDTH;
        const tableY = my - RAIL_WIDTH;

        if (
          tableX >= BALL_RADIUS &&
          tableX <= TABLE_WIDTH - BALL_RADIUS &&
          tableY >= BALL_RADIUS &&
          tableY <= TABLE_HEIGHT - BALL_RADIUS
        ) {
          const isValid = simBallsRef.current.every((b) => {
            if (b.id === 0 || b.pocketed) return true;
            const dx = tableX - b.x;
            const dy = tableY - b.y;
            return Math.sqrt(dx * dx + dy * dy) >= BALL_DIAMETER + 2;
          });

          if (isValid) {
            onPlaceCueBall(tableX, tableY);
            const cue = simBallsRef.current.find((b) => b.id === 0);
            if (cue) {
              cue.x = tableX;
              cue.y = tableY;
              cue.pocketed = false;
            }
          }
        }
        return;
      }

      setIsDragging(true);
      dragStartRef.current = { x: mx, y: my };
      initialAngleRef.current = angleRef.current;
      setPower(0);
    },
    [isMyTurn, ballInHand, onPlaceCueBall]
  );

  // Mouse up handler — fire shot
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !isMyTurn || animatingRef.current) {
      setIsDragging(false);
      setPower(0);
      return;
    }

    if (power > 0.02) {
      const angle = angleRef.current;
      onShoot({ angle, power });
    }

    setIsDragging(false);
    setPower(0);
  }, [isDragging, isMyTurn, power, onShoot]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Run physics if animating
      if (animatingRef.current) {
        const stillMoving = physicsStep(simBallsRef.current);
        if (!stillMoving) {
          animatingRef.current = false;
          if (pendingSyncRef.current) {
            simBallsRef.current = pendingSyncRef.current;
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Table
      drawTable(ctx);

      // Balls
      for (const ball of simBallsRef.current) {
        drawBall(ctx, ball);
      }

      // Interactivity (my turn and not animating)
      if (isMyTurn && !animatingRef.current && !ballInHand) {
        const cueBall = simBallsRef.current.find((b) => b.id === 0);
        if (cueBall && !cueBall.pocketed) {
          // Geometric 8-Ball Pool aim line
          const aim = getAimTrajectory(cueBall, angleRef.current, simBallsRef.current);
          drawAimLine(ctx, cueBall, angleRef.current, aim);

          // Cue stick
          drawCue(ctx, cueBall, angleRef.current, power);

          // Power bar
          if (power > 0) {
            drawPowerBar(ctx, power, canvas.height);
          }
        }
      }

      // Ball in hand
      if (ballInHand) {
        const tableX = mouseRef.current.x - RAIL_WIDTH;
        const tableY = mouseRef.current.y - RAIL_WIDTH;
        const inBounds =
          tableX >= BALL_RADIUS &&
          tableX <= TABLE_WIDTH - BALL_RADIUS &&
          tableY >= BALL_RADIUS &&
          tableY <= TABLE_HEIGHT - BALL_RADIUS;

        const noOverlap = simBallsRef.current.every((b) => {
          if (b.id === 0 || b.pocketed) return true;
          const dx = tableX - b.x;
          const dy = tableY - b.y;
          return Math.sqrt(dx * dx + dy * dy) >= BALL_DIAMETER + 2;
        });

        drawBallInHand(ctx, mouseRef.current.x, mouseRef.current.y, inBounds && noOverlap);
      }

      frameIdRef.current = requestAnimationFrame(render);
    };

    frameIdRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [isMyTurn, ballInHand, power, getAngle]);

  return (
    <div className="game-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: ballInHand ? 'crosshair' : isMyTurn && !animatingRef.current ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
