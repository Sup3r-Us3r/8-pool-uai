// ============================================================
// Types for the 8-Pool-Uai multiplayer pool game
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallState {
  id: number;
  position: Vec2;
  velocity: Vec2;
  pocketed: boolean;
}

export type BallGroup = 'solids' | 'stripes' | '';

export interface PlayerInfo {
  id: number;
  name: string;
  group: BallGroup;
}

export interface RoomInfo {
  roomCode: string;
  roomName: string;
  playerId: number;
}

export type GamePhase = 'lobby' | 'waiting' | 'playing' | 'gameOver';

export interface GameOverData {
  winnerId: number;
  winnerName: string;
  reason: string;
}

export interface ShotStartData {
  shooterId: number;
  angle: number;
  power: number;
  timestamp: number;
}

export interface ShootParams {
  angle: number;
  power: number;
}

export interface GameState {
  phase: GamePhase;
  balls: BallState[];
  activePlayerId: number;
  player1: PlayerInfo;
  player2: PlayerInfo;
  ballInHand: boolean;
  pocketedThisTurn: number[];
  foulMessage: string | null;
  gameOverData: GameOverData | null;
  lastShotStart?: ShotStartData | null;
}

// WebSocket message types
export type MessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'ROOM_CREATED'
  | 'PLAYER_JOINED'
  | 'GAME_START'
  | 'SHOT_STARTED'
  | 'PLAYER_SHOOT'
  | 'SYNC_BALLS'
  | 'TURN_CHANGE'
  | 'FOUL'
  | 'BALL_POCKETED'
  | 'GAME_OVER'
  | 'BALL_IN_HAND'
  | 'PLACE_CUE_BALL'
  | 'ERROR'
  | 'PLAYER_LEFT'
  | 'GROUP_ASSIGNED';

export interface WSMessage {
  type: MessageType;
  payload?: Record<string, unknown>;
}
