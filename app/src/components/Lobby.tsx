// ============================================================
// Lobby — Home screen with Create Room / Join Room tabs
// ============================================================

import { useState } from 'react';
import { CircleDot, LogIn, Plus, Gamepad2 } from 'lucide-react';

interface LobbyProps {
  onCreateRoom: (playerName: string, roomName: string) => void;
  onJoinRoom: (playerName: string, roomCode: string) => void;
  connected: boolean;
  error: string | null;
}

export function Lobby({ onCreateRoom, onJoinRoom, connected, error }: LobbyProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (!playerName.trim()) return;
    onCreateRoom(playerName.trim(), roomName.trim() || `${playerName.trim()}'s Room`);
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="lobby-container">
      {/* Background animated balls */}
      <div className="lobby-bg-balls">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`floating-ball floating-ball-${i + 1}`} />
        ))}
      </div>

      <div className="lobby-card">
        {/* Logo */}
        <div className="lobby-header">
          <div className="lobby-logo">
            <Gamepad2 className="lobby-logo-icon" />
            <div className="lobby-eight-ball">8</div>
          </div>
          <h1 className="lobby-title">
            8-pool-<span className="text-accent">uai</span>
          </h1>
          <p className="lobby-subtitle">Sinuca online multiplayer</p>
        </div>

        {/* Connection status */}
        <div className={`lobby-status ${connected ? 'status-connected' : 'status-disconnected'}`}>
          <CircleDot size={12} />
          <span>{connected ? 'Conectado' : 'Conectando...'}</span>
        </div>

        {/* Error message */}
        {error && (
          <div className="lobby-error">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="lobby-tabs">
          <button
            className={`lobby-tab ${activeTab === 'create' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={16} />
            Criar Sala
          </button>
          <button
            className={`lobby-tab ${activeTab === 'join' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            <LogIn size={16} />
            Entrar em Sala
          </button>
        </div>

        {/* Tab content */}
        <div className="lobby-form">
          <div className="form-group">
            <label className="form-label">Seu Nome</label>
            <input
              className="form-input"
              type="text"
              placeholder="Digite seu nome..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  activeTab === 'create' ? handleCreate() : handleJoin();
                }
              }}
            />
          </div>

          {activeTab === 'create' ? (
            <>
              <div className="form-group">
                <label className="form-label">Nome da Sala (opcional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ex: Mesa do Bar..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={30}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={!playerName.trim() || !connected}
              >
                <Plus size={18} />
                Criar Sala Uai 🎱
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Código da Sala</label>
                <input
                  className="form-input form-input-code"
                  type="text"
                  placeholder="UAI-XXX"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={7}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              <button
                className="btn-primary btn-join"
                onClick={handleJoin}
                disabled={!playerName.trim() || !roomCode.trim() || !connected}
              >
                <LogIn size={18} />
                Entrar na Partida
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
