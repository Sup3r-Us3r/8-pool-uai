package main

import (
	"log"
	"net/http"

	"github.com/8-pool-uai/server/internal/room"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

func main() {
	hub := room.NewHub()

	// WebSocket endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[Server] Upgrade error: %v", err)
			return
		}

		client := room.NewClient(conn, hub)
		log.Printf("[Server] New connection from %s", r.RemoteAddr)

		go client.WritePump()
		go client.ReadPump()
	})

	// Health check
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok", "game": "8-pool-uai"}`))
	})

	// CORS middleware wrapper
	handler := corsMiddleware(http.DefaultServeMux)

	port := ":8080"
	log.Printf("🎱 8-pool-uai server starting on http://localhost%s", port)
	log.Printf("   WebSocket: ws://localhost%s/ws", port)
	log.Printf("   Health:    http://localhost%s/health", port)

	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// corsMiddleware adds CORS headers for development.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
