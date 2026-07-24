// ============================================================
// HUD — Authentic, modern game heads-up display
// ============================================================

import { useEffect, useState } from 'react';
import { Timer, Trophy, AlertTriangle, User, Swords, Key, Sparkles } from 'lucide-react';
import type { GameState, RoomInfo, BallGroup } from '../types';
import { BALL_COLORS } from '../engine/constants';

interface HUDProps {
  gameState: GameState;
  roomInfo: RoomInfo;
}

export function HUD({ gameState, roomInfo }: HUDProps) {
  const { player1, player2, activePlayerId, foulMessage, gameOverData, balls } = gameState;
  const myId = roomInfo.playerId;

  // Turn timer
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    setTimer(30);
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePlayerId, gameState.ballInHand, gameState.lastShotStart?.timestamp]);

  const isMyTurn = activePlayerId === myId;

  // Always position local player on the LEFT and opponent on the RIGHT for complete clarity
  const mePlayer = player1.id === myId ? player1 : player2;
  const opponentPlayer = player1.id === myId ? player2 : player1;

  // Count remaining balls for a group
  const countRemaining = (group: BallGroup): number => {
    if (!group) return 0;
    return balls.filter((b) => {
      if (b.pocketed) return false;
      if (group === 'solids') return b.id >= 1 && b.id <= 7;
      if (group === 'stripes') return b.id >= 9 && b.id <= 15;
      return false;
    }).length;
  };

  const renderPlayerCard = (
    player: typeof player1,
    isLocalPlayer: boolean,
    side: 'left' | 'right'
  ) => {
    const isActive = player.id === activePlayerId;
    const group = player.group;
    const remaining = countRemaining(group);

    // Determine 7 assigned ball IDs (1..7 for solids, 9..15 for stripes)
    const assignedIds =
      group === 'solids'
        ? [1, 2, 3, 4, 5, 6, 7]
        : group === 'stripes'
        ? [9, 10, 11, 12, 13, 14, 15]
        : [];

    return (
      <div
        className={`hud-card ${side} ${
          isActive
            ? isLocalPlayer
              ? 'hud-card-active-me'
              : 'hud-card-active-opponent'
            : ''
        }`}
      >
        {/* Top Header: Avatar + Identity Badge */}
        <div className="hud-card-top">
          <div className="hud-avatar-wrapper">
            <div
              className={`hud-avatar ${
                isLocalPlayer ? 'avatar-me' : 'avatar-opponent'
              }`}
            >
              {isLocalPlayer ? (
                <User size={18} className="avatar-icon" />
              ) : (
                <Swords size={18} className="avatar-icon" />
              )}
            </div>
            {isActive && <div className="hud-avatar-pulse" />}
          </div>

          <div className="hud-player-info">
            <div className="hud-identity-row">
              <span
                className={`hud-identity-badge ${
                  isLocalPlayer ? 'badge-me' : 'badge-opponent'
                }`}
              >
                {isLocalPlayer ? '👤 VOCÊ' : '⚔️ OPONENTE'}
              </span>
              {isActive && (
                <span className="hud-active-chip">
                  <span className="hud-chip-dot" />
                  {isLocalPlayer ? 'SUA VEZ' : 'JOGANDO'}
                </span>
              )}
            </div>
            <h3 className="hud-player-name">{player.name || 'Jogador'}</h3>
          </div>
        </div>

        {/* Group Info + Remaining Count */}
        <div className="hud-card-group-bar">
          {group === 'solids' && (
            <div className="hud-group-pill pill-solids">
              <span className="hud-group-dot dot-solid" />
              <span className="hud-group-name">Lisas</span>
              <span className="hud-group-count">({remaining} restantes)</span>
            </div>
          )}
          {group === 'stripes' && (
            <div className="hud-group-pill pill-stripes">
              <span className="hud-group-dot dot-stripe" />
              <span className="hud-group-name">Listradas</span>
              <span className="hud-group-count">({remaining} restantes)</span>
            </div>
          )}
          {!group && (
            <div className="hud-group-pill pill-none">
              <span>Bolas não definidas</span>
            </div>
          )}
        </div>

        {/* Mini Ball Rack */}
        <div className="hud-ball-rack">
          {assignedIds.length > 0 ? (
            assignedIds.map((id) => {
              const ballObj = balls.find((b) => b.id === id);
              const isPocketed = ballObj ? ballObj.pocketed : false;
              const colorData = BALL_COLORS[id] || { fill: '#888', isStripe: false };

              return (
                <div
                  key={id}
                  className={`hud-rack-ball ${
                    isPocketed ? 'rack-ball-pocketed' : 'rack-ball-active'
                  }`}
                  style={{
                    backgroundColor: isPocketed ? '#1F2937' : colorData.fill,
                  }}
                  title={`Bola ${id} ${isPocketed ? '(Encaçapada)' : '(Na mesa)'}`}
                >
                  {colorData.isStripe && !isPocketed && (
                    <div className="rack-stripe-band" />
                  )}
                  <span className="rack-ball-number">{id}</span>
                </div>
              );
            })
          ) : (
            // Placeholder rack when balls are not assigned yet
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="hud-rack-ball rack-ball-empty">
                <span>?</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="hud-container">
      {/* LEFT: You (Local Player) */}
      {renderPlayerCard(mePlayer, true, 'left')}

      {/* CENTER: Match Info & Timer */}
      <div className="hud-center">
        {/* Room Code Badge */}
        <div className="hud-room-badge" title="Código da Sala">
          <Key size={12} className="text-emerald-400" />
          <span>SALA #{roomInfo.roomCode}</span>
        </div>

        {/* Circular Timer Ring */}
        <div
          className={`hud-timer-ring ${
            timer <= 10 ? 'timer-ring-warning' : ''
          }`}
        >
          <Timer size={18} className="hud-timer-icon" />
          <span className="hud-timer-value">{timer}s</span>
        </div>

        {/* Turn Status Message */}
        <div className="hud-turn-message">
          {isMyTurn ? (
            <span className="text-turn-me">
              <Sparkles size={13} /> É a sua vez de jogar!
            </span>
          ) : (
            <span className="text-turn-opponent">
              Aguardando jogada do adversário...
            </span>
          )}
        </div>

        {/* Status Alerts: Ball in Hand & Foul */}
        {gameState.ballInHand && isMyTurn && (
          <div className="hud-status-banner banner-ball-hand">
            🤚 <strong>Bolão na mão!</strong> Clique na mesa para posicionar
          </div>
        )}

        {foulMessage && (
          <div className="hud-status-banner banner-foul">
            <AlertTriangle size={14} />
            <span>{foulMessage}</span>
          </div>
        )}

        {gameOverData && (
          <div className="hud-status-banner banner-game-over">
            <Trophy size={16} className="text-yellow-400" />
            <span>
              <strong>{gameOverData.winnerName}</strong> venceu! (
              {gameOverData.reason})
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: Opponent */}
      {renderPlayerCard(opponentPlayer, false, 'right')}
    </div>
  );
}
