// ============================================================
// WaitingRoom — Displays room code while waiting for player 2
// ============================================================

import { useState } from 'react';
import { Copy, Check, Loader2, ArrowLeft } from 'lucide-react';
import type { RoomInfo } from '../types';

interface WaitingRoomProps {
  roomInfo: RoomInfo;
  onLeave: () => void;
}

export function WaitingRoom({ roomInfo, onLeave }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomInfo.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = roomInfo.roomCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="waiting-container">
      <div className="waiting-card">
        <div className="waiting-header">
          <h2 className="waiting-title">🎱 Sala Criada!</h2>
          <p className="waiting-room-name">{roomInfo.roomName}</p>
        </div>

        <div className="waiting-code-section">
          <p className="waiting-code-label">Código da Sala</p>
          <div className="waiting-code-box" onClick={copyCode}>
            <span className="waiting-code-text">{roomInfo.roomCode}</span>
            <button className={`btn-copy ${copied ? 'btn-copied' : ''}`}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="waiting-status">
          <Loader2 className="waiting-spinner" size={24} />
          <p>Aguardando o segundo jogador entrar...</p>
          <p className="waiting-hint">Compartilhe o código acima com seu oponente</p>
        </div>

        <button className="btn-back" onClick={onLeave}>
          <ArrowLeft size={16} />
          Voltar ao Lobby
        </button>
      </div>
    </div>
  );
}
