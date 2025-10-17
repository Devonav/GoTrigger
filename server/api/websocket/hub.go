package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// SyncEvent represents a sync notification
type SyncEvent struct {
	Type      string `json:"type"`       // "credentials_changed", "credential_deleted", etc.
	UserID    string `json:"user_id"`
	Zone      string `json:"zone"`
	GenCount  int64  `json:"gencount"`
	Timestamp int64  `json:"timestamp"`
}

// Client represents a connected WebSocket client
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID string
	Zone   string
}

// Hub manages WebSocket connections and broadcasts
type Hub struct {
	// Registered clients mapped by user ID
	clients map[string]map[*Client]bool

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Broadcast messages to clients
	broadcast chan *SyncEvent

	mu sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *SyncEvent, 256),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.UserID] == nil {
				h.clients[client.UserID] = make(map[*Client]bool)
			}
			h.clients[client.UserID][client] = true
			h.mu.Unlock()
			log.Printf("📱 Client connected: user=%s, total_connections=%d",
				client.UserID, len(h.clients[client.UserID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.UserID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)

					// Clean up empty user maps
					if len(clients) == 0 {
						delete(h.clients, client.UserID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("📱 Client disconnected: user=%s", client.UserID)

		case event := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[event.UserID]
			h.mu.RUnlock()

			if clients != nil {
				message, err := json.Marshal(event)
				if err != nil {
					log.Printf("❌ Error marshaling sync event: %v", err)
					continue
				}

				// Broadcast to all clients for this user
				for client := range clients {
					select {
					case client.Send <- message:
						log.Printf("📤 Sent sync event to client: user=%s, type=%s",
							event.UserID, event.Type)
					default:
						// Client buffer full, disconnect
						close(client.Send)
						delete(clients, client)
					}
				}
			}
		}
	}
}

// BroadcastSyncEvent sends a sync event to all connected clients for a user
func (h *Hub) BroadcastSyncEvent(event *SyncEvent) {
	h.broadcast <- event
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		// We don't expect messages from clients, just keep connection alive
	}
}

// WritePump writes messages to the WebSocket connection
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for message := range c.Send {
		err := c.Conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			return
		}
	}
}
