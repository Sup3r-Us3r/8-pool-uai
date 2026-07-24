// ============================================================
// GameScreen — Main game screen combining HUD + Canvas
// ============================================================

import type { GameState, RoomInfo, ShootParams } from '../types';
import { HUD } from './HUD';
import { GameCanvas } from './GameCanvas';
import { Trophy, RotateCcw } from 'lucide-react';

interface GameScreenProps {
  gameState: GameState;
  roomInfo: RoomInfo;
  onShoot: (params: ShootParams) => void;
  onPlaceCueBall: (x: number, y: number) => void;
  onLeave: () => void;
}

export function GameScreen({
  gameState,
  roomInfo,
  onShoot,
  onPlaceCueBall,
  onLeave,
}: GameScreenProps) {
  const isGameOver = gameState.phase === 'gameOver';
  const iWon = gameState.gameOverData?.winnerId === roomInfo.playerId;

  return (
    <div className="game-screen">
      <HUD gameState={gameState} roomInfo={roomInfo} />

      <GameCanvas
        gameState={gameState}
        roomInfo={roomInfo}
        onShoot={onShoot}
        onPlaceCueBall={onPlaceCueBall}
      />

      {/* Game Over Overlay */}
      {isGameOver && gameState.gameOverData && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <Trophy
              size={48}
              className={iWon ? 'game-over-trophy-win' : 'game-over-trophy-lose'}
            />
            <h2 className={`game-over-title ${iWon ? 'text-win' : 'text-lose'}`}>
              {iWon ? '🎉 Vitória!' : '😔 Derrota'}
            </h2>
            <p className="game-over-winner">
              {gameState.gameOverData.winnerName} venceu!
            </p>
            <p className="game-over-reason">{gameState.gameOverData.reason}</p>
            <button className="btn-primary" onClick={onLeave}>
              <RotateCcw size={16} />
              Voltar ao Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
