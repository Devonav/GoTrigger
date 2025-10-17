package handlers

import (
	"log"
	"net/http"

	"github.com/deeplyprofound/password-sync/server/api/websocket"
	"github.com/gin-gonic/gin"
	ws "github.com/gorilla/websocket"
)

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// TODO: Restrict origins in production
		return true
	},
}

type WebSocketHandler struct {
	hub *websocket.Hub
}

func NewWebSocketHandler(hub *websocket.Hub) *WebSocketHandler {
	return &WebSocketHandler{
		hub: hub,
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket and registers client
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get zone from query params
	zone := c.DefaultQuery("zone", "default")

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade error: %v", err)
		return
	}

	// Create client
	client := &websocket.Client{
		Hub:    h.hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID.(string),
		Zone:   zone,
	}

	// Register client with hub
	h.hub.Register <- client

	// Start read and write pumps
	go client.WritePump()
	go client.ReadPump()

	log.Printf("✅ WebSocket connection established: user=%s, zone=%s", userID, zone)
}
