package room

import (
	"encoding/json"
	"log"
	"time"

	"github.com/8-pool-uai/server/internal/protocol"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Client represents a connected WebSocket client.
type Client struct {
	Conn     *websocket.Conn
	Hub      *Hub
	Name     string
	PlayerID int
	Room     *Room
	Send     chan []byte
}

// NewClient creates a new client instance.
func NewClient(conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		Conn: conn,
		Hub:  hub,
		Send: make(chan []byte, 256),
	}
}

// ReadPump reads messages from the WebSocket connection.
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.HandleDisconnect(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[Client] Read error for %s: %v", c.Name, err)
			}
			break
		}
		c.Hub.HandleMessage(c, message)
	}
}

// WritePump writes messages to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendMessage marshals and sends a protocol envelope to the client.
func (c *Client) SendMessage(env protocol.Envelope) {
	data, err := json.Marshal(env)
	if err != nil {
		log.Printf("[Client] Marshal error: %v", err)
		return
	}

	select {
	case c.Send <- data:
	default:
		log.Printf("[Client] Send channel full for %s, dropping message", c.Name)
	}
}

// SendError sends an error message to the client.
func (c *Client) SendError(message string) {
	c.SendMessage(protocol.Envelope{
		Type: protocol.MsgError,
		Payload: map[string]any{
			"message": message,
		},
	})
}
