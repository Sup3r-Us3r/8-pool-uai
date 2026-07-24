// ============================================================
// App.tsx — Root component with routing between screens
// ============================================================

import { useCallback, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { GameScreen } from './components/GameScreen';
import type { ShootParams } from './types';

function App() {
  const { gameState, roomInfo, error, handleMessage, resetGame } = useGameState();
  const { connected, send, connect, disconnect } = useWebSocket({
    onMessage: handleMessage,
  });

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  const handleCreateRoom = useCallback(
    (playerName: string, roomName: string) => {
      send({
        type: 'CREATE_ROOM',
        payload: { playerName, roomName },
      });
    },
    [send]
  );

  const handleJoinRoom = useCallback(
    (playerName: string, roomCode: string) => {
      send({
        type: 'JOIN_ROOM',
        payload: { playerName, roomCode },
      });
    },
    [send]
  );

  const handleShoot = useCallback(
    (params: ShootParams) => {
      send({
        type: 'PLAYER_SHOOT',
        payload: { angle: params.angle, power: params.power },
      });
    },
    [send]
  );

  const handlePlaceCueBall = useCallback(
    (x: number, y: number) => {
      send({
        type: 'PLACE_CUE_BALL',
        payload: { position: { x, y } },
      });
    },
    [send]
  );

  const handleLeave = useCallback(() => {
    disconnect();
    resetGame();
    // Reconnect for new game
    setTimeout(() => connect(), 100);
  }, [disconnect, resetGame, connect]);

  return (
    <div className="app">
      {gameState.phase === 'lobby' && (
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          connected={connected}
          error={error}
        />
      )}

      {gameState.phase === 'waiting' && roomInfo && (
        <WaitingRoom roomInfo={roomInfo} onLeave={handleLeave} />
      )}

      {(gameState.phase === 'playing' || gameState.phase === 'gameOver') && roomInfo && (
        <GameScreen
          gameState={gameState}
          roomInfo={roomInfo}
          onShoot={handleShoot}
          onPlaceCueBall={handlePlaceCueBall}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

export default App;
