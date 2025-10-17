package handlers

import (
	"net/http"
	"time"

	"github.com/deeplyprofound/password-sync/server/domain/auth"
	"github.com/deeplyprofound/password-sync/server/storage"
	"github.com/gin-gonic/gin"
)

type AuthService struct {
	pgStore *storage.PostgresStore
}

func NewAuthService(pgStore *storage.PostgresStore) *AuthService {
	return &AuthService{pgStore: pgStore}
}

// Request/Response types

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type RegisterResponse struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	DeviceID string `json:"device_id,omitempty"`
}

type LoginResponse struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// Handlers

func (s *AuthService) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user already exists
	existingUser, _ := s.pgStore.GetUserByEmail(req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user already exists"})
		return
	}

	// Generate salt and hash password
	salt, err := auth.GenerateSalt()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate salt"})
		return
	}

	passwordHash := auth.HashPassword(req.Password, salt)

	// Create user
	user, err := s.pgStore.CreateUser(req.Email, passwordHash, salt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// Generate JWT access token
	accessToken, err := auth.GenerateAccessToken(user.ID, user.Email, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Generate refresh token (30 days)
	refreshToken, err := s.pgStore.CreateRefreshToken(
		user.ID,
		nil,
		time.Now().Add(30*24*time.Hour),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create refresh token"})
		return
	}

	c.JSON(http.StatusCreated, RegisterResponse{
		UserID:       user.ID,
		Email:        user.Email,
		AccessToken:  accessToken,
		RefreshToken: refreshToken.Token,
	})
}

func (s *AuthService) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user by email
	user, err := s.pgStore.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Verify password
	if !auth.VerifyPassword(req.Password, user.Salt, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Generate JWT access token
	accessToken, err := auth.GenerateAccessToken(user.ID, user.Email, req.DeviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Generate refresh token
	var deviceID *string
	if req.DeviceID != "" {
		deviceID = &req.DeviceID
	}

	refreshToken, err := s.pgStore.CreateRefreshToken(
		user.ID,
		deviceID,
		time.Now().Add(30*24*time.Hour),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create refresh token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		UserID:       user.ID,
		Email:        user.Email,
		AccessToken:  accessToken,
		RefreshToken: refreshToken.Token,
	})
}

func (s *AuthService) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate refresh token
	refreshToken, err := s.pgStore.GetRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Check if revoked or expired
	if refreshToken.Revoked || time.Now().After(refreshToken.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token expired or revoked"})
		return
	}

	// Get user
	user, err := s.pgStore.GetUserByID(refreshToken.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Generate new access token
	deviceID := ""
	if refreshToken.DeviceID != nil {
		deviceID = *refreshToken.DeviceID
	}

	accessToken, err := auth.GenerateAccessToken(user.ID, user.Email, deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Rotate refresh token
	if err := s.pgStore.RevokeRefreshToken(req.RefreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke old token"})
		return
	}

	newRefreshToken, err := s.pgStore.CreateRefreshToken(
		user.ID,
		refreshToken.DeviceID,
		time.Now().Add(30*24*time.Hour),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create refresh token"})
		return
	}

	c.JSON(http.StatusOK, RefreshResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken.Token,
	})
}
