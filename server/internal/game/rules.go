package game

// BallGroup represents the group a player is assigned to.
type BallGroup string

const (
	GroupNone    BallGroup = ""
	GroupSolids  BallGroup = "solids"   // balls 1-7
	GroupStripes BallGroup = "stripes"  // balls 9-15
)

// IsSolid returns true if the ball ID is a solid (1-7).
func IsSolid(id int) bool {
	return id >= 1 && id <= 7
}

// IsStripe returns true if the ball ID is a stripe (9-15).
func IsStripe(id int) bool {
	return id >= 9 && id <= 15
}

// IsEightBall returns true if the ball ID is the 8-ball.
func IsEightBall(id int) bool {
	return id == 8
}

// IsCueBall returns true if the ball ID is the cue ball.
func IsCueBall(id int) bool {
	return id == 0
}

// BelongsToGroup returns true if the ball belongs to the given group.
func BelongsToGroup(ballID int, group BallGroup) bool {
	switch group {
	case GroupSolids:
		return IsSolid(ballID)
	case GroupStripes:
		return IsStripe(ballID)
	default:
		return false
	}
}

// OppositeGroup returns the opposite group.
func OppositeGroup(group BallGroup) BallGroup {
	if group == GroupSolids {
		return GroupStripes
	}
	return GroupSolids
}

// FoulType describes the type of foul committed.
type FoulType string

const (
	FoulCueBallPocketed FoulType = "Bolão caiu na caçapa!"
	FoulWrongBallFirst  FoulType = "Primeira bola atingida não é do seu grupo!"
	FoulNoContact       FoulType = "Bolão não atingiu nenhuma bola!"
	FoulNoRailOrPocket  FoulType = "Nenhuma bola tocou na borda ou caiu na caçapa!"
	FoulEightBallEarly  FoulType = "Bola 8 encaçapada antes de limpar o grupo!"
	FoulTimeout         FoulType = "Tempo esgotado! Falta por tempo."
)

// ShotResult describes the outcome of evaluating a shot against the rules.
type ShotResult struct {
	Foul           bool
	FoulReason     FoulType
	PlayerKeepsTurn bool
	GroupAssigned  bool
	Player1Group   BallGroup
	Player2Group   BallGroup
	GameOver       bool
	WinnerID       int
	GameOverReason string
}

// EvaluateShot applies 8-ball rules to a simulation result.
func EvaluateShot(
	sim SimulationResult,
	activePlayerID int,
	player1Group, player2Group BallGroup,
	isBreakShot bool,
	balls []Ball, // state before the shot
) ShotResult {
	result := ShotResult{
		Player1Group: player1Group,
		Player2Group: player2Group,
	}

	activeGroup := player1Group
	if activePlayerID == 2 {
		activeGroup = player2Group
	}

	// --- Check: Cue ball pocketed ---
	if sim.CueBallPocketed {
		result.Foul = true
		result.FoulReason = FoulCueBallPocketed

		// Check if 8-ball was also pocketed (instant loss)
		for _, pid := range sim.PocketedBalls {
			if IsEightBall(pid) {
				result.GameOver = true
				if activePlayerID == 1 {
					result.WinnerID = 2
				} else {
					result.WinnerID = 1
				}
				result.GameOverReason = "Suicídio na bola 8! Bolão e bola 8 caíram juntos."
				return result
			}
		}
		return result
	}

	// --- Check: No ball hit ---
	if sim.FirstBallHitID < 0 {
		result.Foul = true
		result.FoulReason = FoulNoContact
		return result
	}

	// --- Check: 8-ball pocketed ---
	eightPocketed := false
	for _, pid := range sim.PocketedBalls {
		if IsEightBall(pid) {
			eightPocketed = true
			break
		}
	}

	if eightPocketed {
		// Check if player has cleared their group
		if activeGroup != GroupNone && allGroupPocketed(activeGroup, balls, sim.PocketedBalls) {
			// Legal 8-ball pocket — player wins!
			result.GameOver = true
			result.WinnerID = activePlayerID
			result.GameOverReason = "Todas as bolas do grupo encaçapadas + bola 8! Vitória!"
			return result
		}
		// 8-ball pocketed before clearing group — instant loss
		result.GameOver = true
		if activePlayerID == 1 {
			result.WinnerID = 2
		} else {
			result.WinnerID = 1
		}
		result.GameOverReason = "Bola 8 encaçapada antes de limpar o grupo!"
		return result
	}

	// --- Break shot special rules ---
	if isBreakShot {
		// On break, no foul for hitting any ball first (except cue ball scratch handled above)
		// Table remains open on break, but player keeps turn if any solid/stripe is pocketed
		for _, pid := range sim.PocketedBalls {
			if !IsCueBall(pid) && !IsEightBall(pid) {
				result.PlayerKeepsTurn = true
				break
			}
		}
		return result
	}

	// --- Check: Wrong first ball ---
	if activeGroup != GroupNone {
		// If player's group is assigned, they must hit their own group first
		// Exception: if all group balls are pocketed, they must hit the 8
		if allGroupPocketed(activeGroup, balls, nil) {
			// Player should hit the 8-ball
			if !IsEightBall(sim.FirstBallHitID) {
				result.Foul = true
				result.FoulReason = FoulWrongBallFirst
				return result
			}
		} else if !BelongsToGroup(sim.FirstBallHitID, activeGroup) {
			result.Foul = true
			result.FoulReason = FoulWrongBallFirst
			return result
		}
	} else {
		// Open table: hitting 8-ball first is a foul
		if IsEightBall(sim.FirstBallHitID) {
			result.Foul = true
			result.FoulReason = FoulWrongBallFirst
			return result
		}
	}

	// --- Check: No rail or pocket after contact ---
	if !sim.AnyBallHitCushion && len(sim.PocketedBalls) == 0 {
		result.Foul = true
		result.FoulReason = FoulNoRailOrPocket
		return result
	}

	// --- Group assignment (if not yet assigned and a ball was pocketed) ---
	if activeGroup == GroupNone && len(sim.PocketedBalls) > 0 {
		for _, pid := range sim.PocketedBalls {
			if !IsCueBall(pid) && !IsEightBall(pid) {
				if IsSolid(pid) {
					if activePlayerID == 1 {
						result.Player1Group = GroupSolids
						result.Player2Group = GroupStripes
					} else {
						result.Player1Group = GroupStripes
						result.Player2Group = GroupSolids
					}
				} else {
					if activePlayerID == 1 {
						result.Player1Group = GroupStripes
						result.Player2Group = GroupSolids
					} else {
						result.Player1Group = GroupSolids
						result.Player2Group = GroupStripes
					}
				}
				result.GroupAssigned = true
				activeGroup = result.Player1Group
				if activePlayerID == 2 {
					activeGroup = result.Player2Group
				}
				break
			}
		}
	}

	// --- Determine if player keeps turn ---
	if activeGroup != GroupNone {
		for _, pid := range sim.PocketedBalls {
			if BelongsToGroup(pid, activeGroup) {
				result.PlayerKeepsTurn = true
				break
			}
		}
	} else if len(sim.PocketedBalls) > 0 {
		// No group assigned yet but pocketed something — keep turn
		result.PlayerKeepsTurn = true
	}

	return result
}

// allGroupPocketed checks if all balls in a group are pocketed
// (considering both existing state and newly pocketed balls).
func allGroupPocketed(group BallGroup, balls []Ball, additionalPocketed []int) bool {
	additionalMap := make(map[int]bool)
	for _, id := range additionalPocketed {
		additionalMap[id] = true
	}

	for _, b := range balls {
		if BelongsToGroup(b.ID, group) {
			if !b.Pocketed && !additionalMap[b.ID] {
				return false
			}
		}
	}
	return true
}
