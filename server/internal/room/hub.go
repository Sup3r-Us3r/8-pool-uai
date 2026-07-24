package room

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync"

	"github.com/8-pool-uai/server/internal/game"
	"github.com/8-pool-uai/server/internal/protocol"
)

// Hub manages all active rooms.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
	}
}

// GenerateRoomCode creates a unique room code like "UAI-A3K".
func (h *Hub) GenerateRoomCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	for {
		code := "UAI-"
		for i := 0; i < 3; i++ {
			code += string(chars[rand.Intn(len(chars))])
		}
		h.mu.RLock()
		_, exists := h.rooms[code]
		h.mu.RUnlock()
		if !exists {
			return code
		}
	}
}

// CreateRoom creates a new room and returns its code.
func (h *Hub) CreateRoom(roomName string, host *Client) string {
	code := h.GenerateRoomCode()

	room := &Room{
		Code:    code,
		Name:    roomName,
		Status:  RoomWaiting,
		Player1: host,
		hub:     h,
	}

	host.PlayerID = 1
	host.Room = room

	h.mu.Lock()
	h.rooms[code] = room
	h.mu.Unlock()

	log.Printf("[Hub] Room created: %s (%s) by %s", code, roomName, host.Name)
	return code
}

// JoinRoom adds a player to an existing room.
func (h *Hub) JoinRoom(code string, client *Client) (*Room, error) {
	h.mu.RLock()
	room, exists := h.rooms[code]
	h.mu.RUnlock()

	if !exists {
		return nil, errRoomNotFound
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if room.Status != RoomWaiting {
		return nil, errRoomFull
	}

	if room.Player2 != nil {
		return nil, errRoomFull
	}

	client.PlayerID = 2
	client.Room = room
	room.Player2 = client
	room.Status = RoomPlaying

	log.Printf("[Hub] Player %s joined room %s", client.Name, code)

	return room, nil
}

// RemoveRoom removes a room from the hub.
func (h *Hub) RemoveRoom(code string) {
	h.mu.Lock()
	delete(h.rooms, code)
	h.mu.Unlock()
	log.Printf("[Hub] Room removed: %s", code)
}

// HandleMessage processes an incoming message from a client.
func (h *Hub) HandleMessage(client *Client, raw []byte) {
	var env protocol.Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		client.SendError("Mensagem inválida.")
		return
	}

	switch env.Type {
	case protocol.MsgCreateRoom:
		h.handleCreateRoom(client, env.Payload)
	case protocol.MsgJoinRoom:
		h.handleJoinRoom(client, env.Payload)
	case protocol.MsgPlayerShoot:
		h.handlePlayerShoot(client, env.Payload)
	case protocol.MsgPlaceCueBall:
		h.handlePlaceCueBall(client, env.Payload)
	default:
		client.SendError("Tipo de mensagem desconhecido: " + string(env.Type))
	}
}

func (h *Hub) handleCreateRoom(client *Client, payload map[string]any) {
	playerName, _ := payload["playerName"].(string)
	roomName, _ := payload["roomName"].(string)

	if playerName == "" {
		client.SendError("Nome do jogador é obrigatório.")
		return
	}
	if roomName == "" {
		roomName = playerName + "'s Room"
	}

	client.Name = playerName
	code := h.CreateRoom(roomName, client)

	client.SendMessage(protocol.Envelope{
		Type: protocol.MsgRoomCreated,
		Payload: map[string]any{
			"roomCode": code,
			"roomName": roomName,
			"playerId": 1,
		},
	})
}

func (h *Hub) handleJoinRoom(client *Client, payload map[string]any) {
	playerName, _ := payload["playerName"].(string)
	roomCode, _ := payload["roomCode"].(string)

	if playerName == "" {
		client.SendError("Nome do jogador é obrigatório.")
		return
	}
	if roomCode == "" {
		client.SendError("Código da sala é obrigatório.")
		return
	}

	client.Name = playerName

	room, err := h.JoinRoom(roomCode, client)
	if err != nil {
		client.SendError(err.Error())
		return
	}

	// Send room info to the joining player (so they get roomInfo)
	client.SendMessage(protocol.Envelope{
		Type: protocol.MsgRoomCreated,
		Payload: map[string]any{
			"roomCode": room.Code,
			"roomName": room.Name,
			"playerId": 2,
		},
	})

	// Notify the host that P2 joined
	room.Player1.SendMessage(protocol.Envelope{
		Type: protocol.MsgPlayerJoined,
		Payload: map[string]any{
			"playerName": playerName,
			"playerId":   2,
		},
	})

	// Start the game
	room.StartGame()
}

func (h *Hub) handlePlayerShoot(client *Client, payload map[string]any) {
	if client.Room == nil || client.Room.Game == nil {
		client.SendError("Você não está em uma partida.")
		return
	}

	angle, _ := payload["angle"].(float64)
	power, _ := payload["power"].(float64)

	room := client.Room
	room.StopTurnTimer()

	// Broadcast SHOT_STARTED event so both clients animate the shot synchronously
	shotStartMsg := protocol.Envelope{
		Type: protocol.MsgShotStarted,
		Payload: map[string]any{
			"shooterId": client.PlayerID,
			"angle":     angle,
			"power":     power,
		},
	}
	room.Broadcast(shotStartMsg)

	room.mu.Lock()
	messages := room.Game.ProcessShot(client.PlayerID, angle, power)
	isPlaying := room.Game.Status == game.StatusPlaying
	room.mu.Unlock()

	for _, msg := range messages {
		room.Broadcast(msg)
	}

	if isPlaying {
		room.StartTurnTimer()
	}
}

func (h *Hub) handlePlaceCueBall(client *Client, payload map[string]any) {
	if client.Room == nil || client.Room.Game == nil {
		client.SendError("Você não está em uma partida.")
		return
	}

	posMap, ok := payload["position"].(map[string]any)
	if !ok {
		client.SendError("Posição inválida.")
		return
	}
	x, _ := posMap["x"].(float64)
	y, _ := posMap["y"].(float64)

	room := client.Room
	room.mu.Lock()
	messages := room.Game.PlaceCueBall(client.PlayerID, x, y)
	room.mu.Unlock()

	for _, msg := range messages {
		room.Broadcast(msg)
	}

	room.StartTurnTimer()
}

// HandleDisconnect handles a client disconnecting.
func (h *Hub) HandleDisconnect(client *Client) {
	if client.Room == nil {
		return
	}

	room := client.Room
	room.StopTurnTimer()
	room.mu.Lock()
	defer room.mu.Unlock()

	otherPlayer := room.Player1
	if client.PlayerID == 1 {
		otherPlayer = room.Player2
	}

	if otherPlayer != nil {
		otherPlayer.SendMessage(protocol.Envelope{
			Type: protocol.MsgPlayerLeft,
			Payload: map[string]any{
				"playerName": client.Name,
			},
		})
	}

	// Clean up room
	room.Status = RoomFinished
	h.RemoveRoom(room.Code)
}

// Custom errors
type hubError string

func (e hubError) Error() string { return string(e) }

const (
	errRoomNotFound hubError = "Sala não encontrada. Verifique o código."
	errRoomFull     hubError = "Sala cheia ou jogo já em andamento."
)
