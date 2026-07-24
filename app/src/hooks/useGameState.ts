// ============================================================
// useGameState — Manages the full game state from WS messages
// ============================================================

import { useCallback, useRef, useState } from 'react';
import type {
  BallGroup,
  BallState,
  GameOverData,
  GameState,
  PlayerInfo,
  RoomInfo,
  WSMessage,
} from '../types';

const initialPlayer: PlayerInfo = { id: 0, name: '', group: '' };

const initialGameState: GameState = {
  phase: 'lobby',
  balls: [],
  activePlayerId: 0,
  player1: { ...initialPlayer },
  player2: { ...initialPlayer },
  ballInHand: false,
  pocketedThisTurn: [],
  foulMessage: null,
  gameOverData: null,
};

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const foulTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((msg: WSMessage) => {
    const p = msg.payload || {};

    switch (msg.type) {
      case 'ROOM_CREATED':
        setRoomInfo({
          roomCode: p.roomCode as string,
          roomName: p.roomName as string,
          playerId: p.playerId as number,
        });
        // For P1 (host), this transitions to waiting room.
        // For P2, GAME_START follows immediately and overrides to 'playing'.
        setGameState((prev) => ({ ...prev, phase: 'waiting' }));
        setError(null);
        break;

      case 'PLAYER_JOINED':
        // Player 2 joined — update state
        setGameState((prev) => ({
          ...prev,
          player2: {
            id: p.playerId as number,
            name: p.playerName as string,
            group: '',
          },
        }));
        break;

      case 'GAME_START': {
        const balls = p.balls as BallState[];
        setGameState((prev) => ({
          ...prev,
          phase: 'playing',
          balls,
          activePlayerId: p.firstPlayerId as number,
          player1: {
            id: p.player1Id as number,
            name: p.player1Name as string,
            group: '',
          },
          player2: {
            id: p.player2Id as number,
            name: p.player2Name as string,
            group: '',
          },
          ballInHand: false,
          foulMessage: null,
          gameOverData: null,
          pocketedThisTurn: [],
        }));
        setError(null);
        break;
      }

      case 'SHOT_STARTED':
        setGameState((prev) => ({
          ...prev,
          lastShotStart: {
            shooterId: p.shooterId as number,
            angle: p.angle as number,
            power: p.power as number,
            timestamp: Date.now(),
          },
        }));
        break;

      case 'SYNC_BALLS':
        setGameState((prev) => ({
          ...prev,
          balls: p.balls as BallState[],
          pocketedThisTurn: (p.pocketedThisTurn as number[]) || [],
        }));
        break;

      case 'TURN_CHANGE':
        setGameState((prev) => ({
          ...prev,
          activePlayerId: p.activePlayerId as number,
          ballInHand: p.ballInHand as boolean,
          foulMessage: null,
        }));
        break;

      case 'FOUL': {
        const reason = p.reason as string;
        setGameState((prev) => ({
          ...prev,
          foulMessage: reason,
        }));
        // Clear foul message after 3 seconds
        if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
        foulTimerRef.current = setTimeout(() => {
          setGameState((prev) => ({ ...prev, foulMessage: null }));
        }, 3000);
        break;
      }

      case 'GROUP_ASSIGNED':
        setGameState((prev) => ({
          ...prev,
          player1: {
            ...prev.player1,
            group: p.player1Group as BallGroup,
          },
          player2: {
            ...prev.player2,
            group: p.player2Group as BallGroup,
          },
        }));
        break;

      case 'GAME_OVER':
        setGameState((prev) => ({
          ...prev,
          phase: 'gameOver',
          gameOverData: {
            winnerId: p.winnerId as number,
            winnerName: p.winnerName as string,
            reason: p.reason as string,
          } as GameOverData,
        }));
        break;

      case 'PLAYER_LEFT':
        setError(`${p.playerName as string} saiu da partida.`);
        setGameState((prev) => ({
          ...prev,
          phase: 'lobby',
        }));
        setRoomInfo(null);
        break;

      case 'ERROR':
        setError(p.message as string);
        setTimeout(() => setError(null), 4000);
        break;

      default:
        console.log('[GameState] Unhandled message:', msg.type);
    }
  }, []);

  const resetGame = useCallback(() => {
    setGameState(initialGameState);
    setRoomInfo(null);
    setError(null);
  }, []);

  return {
    gameState,
    roomInfo,
    error,
    handleMessage,
    resetGame,
  };
}
