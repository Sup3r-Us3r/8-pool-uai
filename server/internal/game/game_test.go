package game

import (
	"testing"
)

func TestNewGameState(t *testing.T) {
	gs := NewGameState("P1", "P2")
	if gs.Status != StatusPlaying {
		t.Fatalf("expected StatusPlaying, got %v", gs.Status)
	}
	if len(gs.Balls) != 16 {
		t.Fatalf("expected 16 balls, got %d", len(gs.Balls))
	}
	if gs.ActivePlayerID != 1 {
		t.Fatalf("expected ActivePlayerID = 1, got %d", gs.ActivePlayerID)
	}
	if !gs.IsBreakShot {
		t.Fatalf("expected IsBreakShot = true")
	}
}

func TestBreakShotKeepOpenTable(t *testing.T) {
	gs := NewGameState("P1", "P2")

	// Simulate shot where ball 1 is pocketed on break
	sim := SimulationResult{
		Balls:             gs.Balls,
		PocketedBalls:     []int{1},
		FirstBallHitID:    1,
		CueBallPocketed:   false,
		AnyBallHitCushion: true,
	}

	result := EvaluateShot(sim, 1, GroupNone, GroupNone, true, gs.Balls)

	if result.Foul {
		t.Errorf("expected no foul on break shot with ball pocketed")
	}
	if !result.PlayerKeepsTurn {
		t.Errorf("expected player to keep turn on break pocket")
	}
	if result.GroupAssigned {
		t.Errorf("expected table to remain open (GroupAssigned = false) on break shot")
	}
}

func TestOpenTableHitEightBallFoul(t *testing.T) {
	gs := NewGameState("P1", "P2")
	gs.IsBreakShot = false // normal turn, open table

	sim := SimulationResult{
		Balls:             gs.Balls,
		PocketedBalls:     []int{},
		FirstBallHitID:    8, // hit 8-ball first on open table
		CueBallPocketed:   false,
		AnyBallHitCushion: true,
	}

	result := EvaluateShot(sim, 1, GroupNone, GroupNone, false, gs.Balls)

	if !result.Foul {
		t.Fatalf("expected foul when hitting 8-ball first on open table")
	}
	if result.FoulReason != FoulWrongBallFirst {
		t.Fatalf("expected FoulWrongBallFirst, got %v", result.FoulReason)
	}
}

func TestPocketFunnelingPhysics(t *testing.T) {
	balls := InitialBallSetup()

	// Position cue ball near top-left pocket (dist ~ 25 units, radius = 22)
	balls[0].Position = Vec2{X: 18, Y: 18}

	// Run simulation with 0 power (let funneling pull it in)
	sim := SimulateShot(balls, 0, 0.05)

	cuePocketed := false
	for _, id := range sim.PocketedBalls {
		if id == 0 {
			cuePocketed = true
			break
		}
	}

	if !cuePocketed {
		t.Fatalf("expected cue ball near pocket to be pulled in by funneling physics")
	}
}
