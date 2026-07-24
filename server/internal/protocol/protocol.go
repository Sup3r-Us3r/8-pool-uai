package protocol

// MessageType defines the type of WebSocket message.
type MessageType string

const (
	// Client -> Server
	MsgCreateRoom  MessageType = "CREATE_ROOM"
	MsgJoinRoom    MessageType = "JOIN_ROOM"
	MsgPlayerShoot MessageType = "PLAYER_SHOOT"
	MsgPlaceCueBall MessageType = "PLACE_CUE_BALL"

	// Server -> Client
	MsgRoomCreated   MessageType = "ROOM_CREATED"
	MsgPlayerJoined  MessageType = "PLAYER_JOINED"
	MsgGameStart     MessageType = "GAME_START"
	MsgShotStarted   MessageType = "SHOT_STARTED"
	MsgSyncBalls     MessageType = "SYNC_BALLS"
	MsgTurnChange    MessageType = "TURN_CHANGE"
	MsgFoul          MessageType = "FOUL"
	MsgBallPocketed  MessageType = "BALL_POCKETED"
	MsgGameOver      MessageType = "GAME_OVER"
	MsgBallInHand    MessageType = "BALL_IN_HAND"
	MsgError         MessageType = "ERROR"
	MsgPlayerLeft    MessageType = "PLAYER_LEFT"
	MsgGroupAssigned MessageType = "GROUP_ASSIGNED"
)

// Vec2 represents a 2D vector.
type Vec2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BallState represents the state of a single ball.
type BallState struct {
	ID       int    `json:"id"`
	Position Vec2   `json:"position"`
	Velocity Vec2   `json:"velocity"`
	Pocketed bool   `json:"pocketed"`
}

// Envelope is the top-level message wrapper.
type Envelope struct {
	Type    MessageType    `json:"type"`
	Payload map[string]any `json:"payload,omitempty"`
}

// --- Client -> Server Payloads ---

// CreateRoomPayload is sent by the host to create a room.
type CreateRoomPayload struct {
	PlayerName string `json:"playerName"`
	RoomName   string `json:"roomName"`
}

// JoinRoomPayload is sent by player 2 to join a room.
type JoinRoomPayload struct {
	PlayerName string `json:"playerName"`
	RoomCode   string `json:"roomCode"`
}

// ShootPayload contains the parameters of a shot.
type ShootPayload struct {
	Angle float64 `json:"angle"` // radians
	Power float64 `json:"power"` // 0.0 to 1.0
}

// PlaceCueBallPayload is sent when placing the cue ball after a foul.
type PlaceCueBallPayload struct {
	Position Vec2 `json:"position"`
}

// --- Server -> Client Payloads ---

// RoomCreatedPayload is sent back to the host after room creation.
type RoomCreatedPayload struct {
	RoomCode string `json:"roomCode"`
	RoomName string `json:"roomName"`
	PlayerID int    `json:"playerId"`
}

// PlayerJoinedPayload notifies the host that player 2 joined.
type PlayerJoinedPayload struct {
	PlayerName string `json:"playerName"`
	PlayerID   int    `json:"playerId"`
}

// GameStartPayload notifies both players the game has started.
type GameStartPayload struct {
	Balls         []BallState `json:"balls"`
	FirstPlayerID int         `json:"firstPlayerId"`
	Player1Name   string      `json:"player1Name"`
	Player2Name   string      `json:"player2Name"`
	Player1ID     int         `json:"player1Id"`
	Player2ID     int         `json:"player2Id"`
}

// SyncBallsPayload synchronizes ball positions after a shot.
type SyncBallsPayload struct {
	Balls          []BallState `json:"balls"`
	PocketedThisTurn []int     `json:"pocketedThisTurn"`
}

// TurnChangePayload notifies which player's turn it is.
type TurnChangePayload struct {
	ActivePlayerID int  `json:"activePlayerId"`
	BallInHand     bool `json:"ballInHand"`
}

// FoulPayload describes a foul.
type FoulPayload struct {
	Reason    string `json:"reason"`
	PlayerID  int    `json:"playerId"`
}

// BallPocketedPayload notifies that a ball was pocketed.
type BallPocketedPayload struct {
	BallID   int `json:"ballId"`
	PlayerID int `json:"playerId"`
}

// GroupAssignedPayload notifies group assignment.
type GroupAssignedPayload struct {
	Player1Group string `json:"player1Group"` // "solids" or "stripes"
	Player2Group string `json:"player2Group"` // "solids" or "stripes"
}

// GameOverPayload announces the end of the game.
type GameOverPayload struct {
	WinnerID   int    `json:"winnerId"`
	WinnerName string `json:"winnerName"`
	Reason     string `json:"reason"`
}

// ErrorPayload describes an error.
type ErrorPayload struct {
	Message string `json:"message"`
}
