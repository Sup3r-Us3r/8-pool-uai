package room

import (
	"log"
	"sync"
	"time"

	"github.com/8-pool-uai/server/internal/game"
	"github.com/8-pool-uai/server/internal/protocol"
)

// RoomStatus represents the lifecycle state of a room.
type RoomStatus string

const (
	RoomWaiting  RoomStatus = "waiting"
	RoomPlaying  RoomStatus = "playing"
	RoomFinished RoomStatus = "finished"
)

const TurnTimeoutDuration = 30 * time.Second

// Room represents a game room with two players.
type Room struct {
	Code      string
	Name      string
	Status    RoomStatus
	Player1   *Client
	Player2   *Client
	Game      *game.GameState
	hub       *Hub
	turnTimer *time.Timer
	mu        sync.Mutex
}

// StartGame initializes the game and notifies both players.
func (r *Room) StartGame() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.Game = game.NewGameState(r.Player1.Name, r.Player2.Name)
	r.Status = RoomPlaying

	startMsg := protocol.Envelope{
		Type: protocol.MsgGameStart,
		Payload: map[string]any{
			"balls":         r.Game.GetBallStates(),
			"firstPlayerId": r.Game.ActivePlayerID,
			"player1Name":   r.Player1.Name,
			"player2Name":   r.Player2.Name,
			"player1Id":     1,
			"player2Id":     2,
		},
	}

	r.Player1.SendMessage(startMsg)
	r.Player2.SendMessage(startMsg)

	r.restartTurnTimerLocked()

	log.Printf("[Room] Game started in room %s: %s vs %s", r.Code, r.Player1.Name, r.Player2.Name)
}

// StartTurnTimer restarts the turn timer for 30 seconds.
func (r *Room) StartTurnTimer() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.restartTurnTimerLocked()
}

func (r *Room) restartTurnTimerLocked() {
	if r.turnTimer != nil {
		r.turnTimer.Stop()
	}
	if r.Status == RoomPlaying {
		r.turnTimer = time.AfterFunc(TurnTimeoutDuration, r.onTurnTimeout)
	}
}

// StopTurnTimer stops the current turn timer.
func (r *Room) StopTurnTimer() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.turnTimer != nil {
		r.turnTimer.Stop()
		r.turnTimer = nil
	}
}

func (r *Room) onTurnTimeout() {
	r.mu.Lock()
	if r.Status != RoomPlaying || r.Game == nil {
		r.mu.Unlock()
		return
	}

	log.Printf("[Room] Turn timeout in room %s for active player %d", r.Code, r.Game.ActivePlayerID)
	messages := r.Game.HandleTimeout()
	if r.Game.Status == game.StatusFinished {
		r.Status = RoomFinished
	}
	r.mu.Unlock()

	for _, msg := range messages {
		r.Broadcast(msg)
	}

	r.StartTurnTimer()
}

// Broadcast sends a message to both players in the room.
func (r *Room) Broadcast(msg protocol.Envelope) {
	if r.Player1 != nil {
		r.Player1.SendMessage(msg)
	}
	if r.Player2 != nil {
		r.Player2.SendMessage(msg)
	}
}
