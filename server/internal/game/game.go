package game

import (
	"github.com/8-pool-uai/server/internal/protocol"
)

// GameStatus represents the current phase of the game.
type GameStatus string

const (
	StatusWaiting  GameStatus = "waiting"
	StatusPlaying  GameStatus = "playing"
	StatusFinished GameStatus = "finished"
)

// Player represents a player in the game.
type Player struct {
	ID    int
	Name  string
	Group BallGroup
}

// GameState holds the full state of a game in progress.
type GameState struct {
	Status          GameStatus
	Balls           []Ball
	Player1         Player
	Player2         Player
	ActivePlayerID  int
	IsBreakShot     bool
	BallInHand      bool
	TurnNumber      int
}

// NewGameState creates a new game with initial ball setup.
func NewGameState(p1Name, p2Name string) *GameState {
	return &GameState{
		Status:         StatusPlaying,
		Balls:          InitialBallSetup(),
		Player1:        Player{ID: 1, Name: p1Name, Group: GroupNone},
		Player2:        Player{ID: 2, Name: p2Name, Group: GroupNone},
		ActivePlayerID: 1,
		IsBreakShot:    true,
		BallInHand:     false,
		TurnNumber:     1,
	}
}

// GetBallStates converts internal balls to protocol format.
func (g *GameState) GetBallStates() []protocol.BallState {
	states := make([]protocol.BallState, len(g.Balls))
	for i, b := range g.Balls {
		states[i] = protocol.BallState{
			ID: b.ID,
			Position: protocol.Vec2{
				X: b.Position.X,
				Y: b.Position.Y,
			},
			Velocity: protocol.Vec2{
				X: b.Velocity.X,
				Y: b.Velocity.Y,
			},
			Pocketed: b.Pocketed,
		}
	}
	return states
}

// ProcessShot handles a player's shot: runs physics and applies rules.
// Returns a list of protocol messages to broadcast.
func (g *GameState) ProcessShot(playerID int, angle, power float64) []protocol.Envelope {
	var messages []protocol.Envelope

	// Validate it's this player's turn
	if playerID != g.ActivePlayerID {
		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgError,
			Payload: map[string]any{
				"message": "Não é o seu turno!",
			},
		})
		return messages
	}

	if g.Status != StatusPlaying {
		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgError,
			Payload: map[string]any{
				"message": "O jogo não está em andamento.",
			},
		})
		return messages
	}

	// Clamp power
	if power < 0 {
		power = 0
	}
	if power > 1 {
		power = 1
	}

	// Run physics simulation
	sim := SimulateShot(g.Balls, angle, power)

	// Evaluate rules
	shotResult := EvaluateShot(
		sim,
		g.ActivePlayerID,
		g.Player1.Group,
		g.Player2.Group,
		g.IsBreakShot,
		g.Balls,
	)

	// Update ball positions
	g.Balls = sim.Balls

	// Send sync
	pocketedThisTurn := make([]int, 0)
	for _, pid := range sim.PocketedBalls {
		if !IsCueBall(pid) {
			pocketedThisTurn = append(pocketedThisTurn, pid)
		}
	}

	messages = append(messages, protocol.Envelope{
		Type: protocol.MsgSyncBalls,
		Payload: map[string]any{
			"balls":            g.GetBallStates(),
			"pocketedThisTurn": pocketedThisTurn,
		},
	})

	// Handle group assignment
	if shotResult.GroupAssigned {
		g.Player1.Group = shotResult.Player1Group
		g.Player2.Group = shotResult.Player2Group

		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgGroupAssigned,
			Payload: map[string]any{
				"player1Group": string(shotResult.Player1Group),
				"player2Group": string(shotResult.Player2Group),
			},
		})
	}

	// Handle game over
	if shotResult.GameOver {
		g.Status = StatusFinished
		winnerName := g.Player1.Name
		if shotResult.WinnerID == 2 {
			winnerName = g.Player2.Name
		}

		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgGameOver,
			Payload: map[string]any{
				"winnerId":   shotResult.WinnerID,
				"winnerName": winnerName,
				"reason":     shotResult.GameOverReason,
			},
		})
		return messages
	}

	// Handle foul
	if shotResult.Foul {
		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgFoul,
			Payload: map[string]any{
				"reason":   string(shotResult.FoulReason),
				"playerId": g.ActivePlayerID,
			},
		})

		// Reset cue ball if pocketed
		if sim.CueBallPocketed {
			ResetCueBall(g.Balls)
		}

		// Switch turn with ball-in-hand
		g.switchTurn()
		g.BallInHand = true
		g.IsBreakShot = false

		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgTurnChange,
			Payload: map[string]any{
				"activePlayerId": g.ActivePlayerID,
				"ballInHand":     true,
			},
		})
		return messages
	}

	// No foul
	g.IsBreakShot = false

	if shotResult.PlayerKeepsTurn {
		// Player keeps turn
		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgTurnChange,
			Payload: map[string]any{
				"activePlayerId": g.ActivePlayerID,
				"ballInHand":     false,
			},
		})
	} else {
		// Switch turn
		g.switchTurn()
		g.BallInHand = false

		messages = append(messages, protocol.Envelope{
			Type: protocol.MsgTurnChange,
			Payload: map[string]any{
				"activePlayerId": g.ActivePlayerID,
				"ballInHand":     false,
			},
		})
	}

	return messages
}

// PlaceCueBall sets the cue ball position (after ball-in-hand).
func (g *GameState) PlaceCueBall(playerID int, x, y float64) []protocol.Envelope {
	if playerID != g.ActivePlayerID || !g.BallInHand {
		return []protocol.Envelope{{
			Type: protocol.MsgError,
			Payload: map[string]any{
				"message": "Ação inválida.",
			},
		}}
	}

	// Clamp within table
	if x < BallRadius {
		x = BallRadius
	}
	if x > TableWidth-BallRadius {
		x = TableWidth - BallRadius
	}
	if y < BallRadius {
		y = BallRadius
	}
	if y > TableHeight-BallRadius {
		y = TableHeight - BallRadius
	}

	// Check no overlap with other balls
	for _, b := range g.Balls {
		if b.ID == 0 || b.Pocketed {
			continue
		}
		diff := Vec2{X: x - b.Position.X, Y: y - b.Position.Y}
		if diff.Length() < BallDiameter+2 {
			return []protocol.Envelope{{
				Type: protocol.MsgError,
				Payload: map[string]any{
					"message": "Posição inválida — sobre outra bola.",
				},
			}}
		}
	}

	// Place cue ball
	for i := range g.Balls {
		if g.Balls[i].ID == 0 {
			g.Balls[i].Position = Vec2{X: x, Y: y}
			g.Balls[i].Velocity = Vec2{0, 0}
			g.Balls[i].Pocketed = false
			break
		}
	}

	g.BallInHand = false

	return []protocol.Envelope{
		{
			Type: protocol.MsgSyncBalls,
			Payload: map[string]any{
				"balls":            g.GetBallStates(),
				"pocketedThisTurn": []int{},
			},
		},
		{
			Type: protocol.MsgTurnChange,
			Payload: map[string]any{
				"activePlayerId": g.ActivePlayerID,
				"ballInHand":     false,
			},
		},
	}
}

// HandleTimeout applies a turn-timeout foul when the turn timer expires.
func (g *GameState) HandleTimeout() []protocol.Envelope {
	if g.Status != StatusPlaying {
		return nil
	}

	var messages []protocol.Envelope

	// Foul notification
	messages = append(messages, protocol.Envelope{
		Type: protocol.MsgFoul,
		Payload: map[string]any{
			"reason":   string(FoulTimeout),
			"playerId": g.ActivePlayerID,
		},
	})

	// Reset cue ball if pocketed
	ResetCueBall(g.Balls)

	// Switch turn with ball-in-hand for opponent
	g.switchTurn()
	g.BallInHand = true
	g.IsBreakShot = false

	messages = append(messages, protocol.Envelope{
		Type: protocol.MsgTurnChange,
		Payload: map[string]any{
			"activePlayerId": g.ActivePlayerID,
			"ballInHand":     true,
		},
	})

	messages = append(messages, protocol.Envelope{
		Type: protocol.MsgSyncBalls,
		Payload: map[string]any{
			"balls":            g.GetBallStates(),
			"pocketedThisTurn": []int{},
		},
	})

	return messages
}

// switchTurn toggles the active player.
func (g *GameState) switchTurn() {
	if g.ActivePlayerID == 1 {
		g.ActivePlayerID = 2
	} else {
		g.ActivePlayerID = 1
	}
	g.TurnNumber++
}

// RemainingBalls returns count of remaining balls for each group.
func (g *GameState) RemainingBalls() (solids, stripes int) {
	for _, b := range g.Balls {
		if b.Pocketed {
			continue
		}
		if IsSolid(b.ID) {
			solids++
		}
		if IsStripe(b.ID) {
			stripes++
		}
	}
	return
}
