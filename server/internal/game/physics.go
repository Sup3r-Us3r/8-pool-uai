package game

import "math"

// --- Constants ---

const (
	// Table dimensions (internal play area in game units)
	TableWidth  = 1040.0
	TableHeight = 520.0

	// Ball properties
	BallRadius   = 12.0
	BallDiameter = BallRadius * 2

	// Pocket properties
	PocketRadius = 22.0

	// Physics
	Friction       = 0.985  // per-frame velocity multiplier
	MinVelocity    = 0.15   // below this, ball stops
	MaxShotPower   = 25.0   // max initial velocity
	TimeStep       = 1.0    // physics step
	MaxSimSteps    = 10000  // safety limit per shot

	// Cushion restitution (how much energy is preserved on bounce)
	CushionRestitution = 0.75
	// Ball-ball restitution
	BallRestitution = 0.96
)

// PocketPositions defines the 6 pocket locations.
var PocketPositions = []Vec2{
	{X: 0, Y: 0},                               // top-left
	{X: TableWidth / 2, Y: -5},                  // top-center
	{X: TableWidth, Y: 0},                       // top-right
	{X: 0, Y: TableHeight},                      // bottom-left
	{X: TableWidth / 2, Y: TableHeight + 5},     // bottom-center
	{X: TableWidth, Y: TableHeight},              // bottom-right
}

// Vec2 is a 2D vector.
type Vec2 struct {
	X float64
	Y float64
}

func (v Vec2) Add(other Vec2) Vec2 {
	return Vec2{X: v.X + other.X, Y: v.Y + other.Y}
}

func (v Vec2) Sub(other Vec2) Vec2 {
	return Vec2{X: v.X - other.X, Y: v.Y - other.Y}
}

func (v Vec2) Scale(s float64) Vec2 {
	return Vec2{X: v.X * s, Y: v.Y * s}
}

func (v Vec2) Length() float64 {
	return math.Sqrt(v.X*v.X + v.Y*v.Y)
}

func (v Vec2) LengthSq() float64 {
	return v.X*v.X + v.Y*v.Y
}

func (v Vec2) Normalize() Vec2 {
	l := v.Length()
	if l < 1e-10 {
		return Vec2{0, 0}
	}
	return Vec2{X: v.X / l, Y: v.Y / l}
}

func (v Vec2) Dot(other Vec2) float64 {
	return v.X*other.X + v.Y*other.Y
}

// Ball represents a pool ball in the physics simulation.
type Ball struct {
	ID       int
	Position Vec2
	Velocity Vec2
	Pocketed bool
}

// SimulationResult contains the outcome of a shot simulation.
type SimulationResult struct {
	Balls             []Ball
	PocketedBalls     []int // IDs of balls pocketed during this shot
	FirstBallHitID    int   // ID of the first ball hit by cue ball (-1 if none)
	CueBallPocketed   bool
	AnyBallHitCushion bool  // did any ball touch a cushion after cue ball contact?
}

// SimulateShot runs the physics simulation for a shot.
// angle is in radians, power is 0.0 to 1.0.
func SimulateShot(balls []Ball, angle, power float64) SimulationResult {
	// Deep copy balls
	simBalls := make([]Ball, len(balls))
	for i, b := range balls {
		simBalls[i] = Ball{
			ID:       b.ID,
			Position: b.Position,
			Velocity: b.Velocity,
			Pocketed: b.Pocketed,
		}
	}

	// Apply velocity to cue ball (ID 0)
	speed := power * MaxShotPower
	for i := range simBalls {
		if simBalls[i].ID == 0 && !simBalls[i].Pocketed {
			simBalls[i].Velocity = Vec2{
				X: math.Cos(angle) * speed,
				Y: math.Sin(angle) * speed,
			}
			break
		}
	}

	result := SimulationResult{
		FirstBallHitID:    -1,
		CueBallPocketed:   false,
		AnyBallHitCushion: false,
	}

	pocketedMap := make(map[int]bool)
	firstHitRecorded := false
	cueHasMoved := false

	const subSteps = 8
	subDt := TimeStep / float64(subSteps)
	subFriction := math.Pow(Friction, 1.0/float64(subSteps))

	// Run simulation until all balls stop or we hit max steps
	for step := 0; step < MaxSimSteps; step++ {
		allStopped := true

		for sub := 0; sub < subSteps; sub++ {
			// Update positions
			for i := range simBalls {
				if simBalls[i].Pocketed {
					continue
				}
				if simBalls[i].Velocity.LengthSq() > MinVelocity*MinVelocity {
					allStopped = false
					simBalls[i].Position = simBalls[i].Position.Add(simBalls[i].Velocity.Scale(subDt))
				}
			}

			if simBalls[0].Velocity.LengthSq() > MinVelocity*MinVelocity {
				cueHasMoved = true
			}

			// Ball-ball collisions
			for i := 0; i < len(simBalls); i++ {
				if simBalls[i].Pocketed {
					continue
				}
				for j := i + 1; j < len(simBalls); j++ {
					if simBalls[j].Pocketed {
						continue
					}
					resolveBallCollision(&simBalls[i], &simBalls[j])

					// Track first ball hit by cue ball
					if !firstHitRecorded {
						diff := simBalls[i].Position.Sub(simBalls[j].Position)
						dist := diff.Length()
						if dist < BallDiameter+0.5 {
							if simBalls[i].ID == 0 {
								result.FirstBallHitID = simBalls[j].ID
								firstHitRecorded = true
							} else if simBalls[j].ID == 0 {
								result.FirstBallHitID = simBalls[i].ID
								firstHitRecorded = true
							}
						}
					}
				}
			}

			// Cushion collisions
			for i := range simBalls {
				if simBalls[i].Pocketed {
					continue
				}
				if resolveWallCollision(&simBalls[i]) && cueHasMoved {
					result.AnyBallHitCushion = true
				}
			}

			// Pocket detection & funneling
			for i := range simBalls {
				if simBalls[i].Pocketed {
					continue
				}
				if isBallInPocket(simBalls[i].Position) {
					simBalls[i].Pocketed = true
					simBalls[i].Velocity = Vec2{0, 0}
					if !pocketedMap[simBalls[i].ID] {
						pocketedMap[simBalls[i].ID] = true
						result.PocketedBalls = append(result.PocketedBalls, simBalls[i].ID)
						if simBalls[i].ID == 0 {
							result.CueBallPocketed = true
						}
					}
				}
			}

			// Apply friction per sub-step
			for i := range simBalls {
				if simBalls[i].Pocketed {
					continue
				}
				simBalls[i].Velocity = simBalls[i].Velocity.Scale(subFriction)
				if simBalls[i].Velocity.LengthSq() < MinVelocity*MinVelocity {
					simBalls[i].Velocity = Vec2{0, 0}
				}
			}
		}

		if allStopped && cueHasMoved {
			break
		}
	}

	result.Balls = simBalls
	return result
}

// resolveBallCollision handles elastic collision between two balls.
func resolveBallCollision(a, b *Ball) {
	diff := a.Position.Sub(b.Position)
	dist := diff.Length()

	if dist > BallDiameter || dist < 1e-10 {
		return
	}

	// Normal vector from b to a
	normal := diff.Normalize()

	// Separate overlapping balls
	overlap := BallDiameter - dist
	separation := normal.Scale(overlap / 2)
	a.Position = a.Position.Add(separation)
	b.Position = b.Position.Sub(separation)

	// Relative velocity
	relVel := a.Velocity.Sub(b.Velocity)
	velAlongNormal := relVel.Dot(normal)

	// Only resolve if balls are moving toward each other
	if velAlongNormal > 0 {
		return
	}

	// Elastic collision (equal mass)
	impulse := normal.Scale(velAlongNormal * BallRestitution)
	a.Velocity = a.Velocity.Sub(impulse)
	b.Velocity = b.Velocity.Add(impulse)
}

// resolveWallCollision handles ball-cushion collisions. Returns true if a bounce occurred.
func resolveWallCollision(ball *Ball) bool {
	bounced := false

	if ball.Position.X-BallRadius < 0 {
		ball.Position.X = BallRadius
		ball.Velocity.X = -ball.Velocity.X * CushionRestitution
		bounced = true
	}
	if ball.Position.X+BallRadius > TableWidth {
		ball.Position.X = TableWidth - BallRadius
		ball.Velocity.X = -ball.Velocity.X * CushionRestitution
		bounced = true
	}
	if ball.Position.Y-BallRadius < 0 {
		ball.Position.Y = BallRadius
		ball.Velocity.Y = -ball.Velocity.Y * CushionRestitution
		bounced = true
	}
	if ball.Position.Y+BallRadius > TableHeight {
		ball.Position.Y = TableHeight - BallRadius
		ball.Velocity.Y = -ball.Velocity.Y * CushionRestitution
		bounced = true
	}

	return bounced
}

// isBallInPocket checks if a ball position is within any pocket.
func isBallInPocket(pos Vec2) bool {
	for _, pocket := range PocketPositions {
		diff := pos.Sub(pocket)
		if diff.Length() < PocketRadius {
			return true
		}
	}
	return false
}

// InitialBallSetup returns the standard triangle rack + cue ball positions.
func InitialBallSetup() []Ball {
	balls := make([]Ball, 16)

	// Cue ball (ID 0) — on the left quarter
	balls[0] = Ball{
		ID:       0,
		Position: Vec2{X: TableWidth * 0.25, Y: TableHeight / 2},
	}

	// Rack position — right quarter
	startX := TableWidth * 0.73
	startY := TableHeight / 2.0
	spacing := BallDiameter + 1.0

	// Standard 8-ball rack layout (5 rows):
	// Row 0: 1 ball, Row 1: 2 balls, Row 2: 3 balls, Row 3: 4 balls, Row 4: 5 balls
	// The 8-ball must be in the center of row 2
	// One solid and one stripe in the back corners
	rackOrder := []int{
		1,       // row 0: 1 ball
		9, 2,    // row 1: 2 balls
		3, 8, 10, // row 2: 3 balls (8 in center)
		11, 4, 5, 12, // row 3: 4 balls
		6, 13, 14, 7, 15, // row 4: 5 balls
	}

	idx := 0
	for row := 0; row < 5; row++ {
		rowBalls := row + 1
		for col := 0; col < rowBalls; col++ {
			x := startX + float64(row)*spacing*0.866 // cos(30°)
			y := startY + float64(col)*spacing - float64(rowBalls-1)*spacing/2.0

			ballID := rackOrder[idx]
			balls[ballID] = Ball{
				ID:       ballID,
				Position: Vec2{X: x, Y: y},
			}
			idx++
		}
	}

	return balls
}

// ResetCueBall places the cue ball back at default position.
func ResetCueBall(balls []Ball) {
	for i := range balls {
		if balls[i].ID == 0 {
			balls[i].Position = Vec2{X: TableWidth * 0.25, Y: TableHeight / 2}
			balls[i].Velocity = Vec2{0, 0}
			balls[i].Pocketed = false
			break
		}
	}
}
