package handlers

import (
	"net/http"

	"github.com/deeplyprofound/password-sync/server/storage"
	"github.com/gin-gonic/gin"
)

type DeviceHandler struct {
	pgStore *storage.PostgresStore
}

func NewDeviceHandler(pgStore *storage.PostgresStore) *DeviceHandler {
	return &DeviceHandler{pgStore: pgStore}
}

type RegisterDeviceRequest struct {
	DeviceName string `json:"device_name" binding:"required"`
	DeviceType string `json:"device_type" binding:"required"`
	PublicKey  []byte `json:"public_key,omitempty"`
}

type DeviceResponse struct {
	ID         string `json:"id"`
	DeviceName string `json:"device_name"`
	DeviceType string `json:"device_type"`
	CreatedAt  string `json:"created_at"`
}

func (h *DeviceHandler) RegisterDevice(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := h.pgStore.CreateDevice(
		userID.(string),
		req.DeviceName,
		req.DeviceType,
		req.PublicKey,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, DeviceResponse{
		ID:         device.ID,
		DeviceName: device.DeviceName,
		DeviceType: device.DeviceType,
		CreatedAt:  device.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *DeviceHandler) ListDevices(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	devices, err := h.pgStore.GetDevicesByUserID(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]DeviceResponse, len(devices))
	for i, device := range devices {
		result[i] = DeviceResponse{
			ID:         device.ID,
			DeviceName: device.DeviceName,
			DeviceType: device.DeviceType,
			CreatedAt:  device.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	c.JSON(http.StatusOK, result)
}
