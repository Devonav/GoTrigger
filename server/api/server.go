package api

import (
	"net/http"
	"time"

	"github.com/deeplyprofound/password-sync/server/api/handlers"
	"github.com/deeplyprofound/password-sync/server/api/middleware"
	"github.com/deeplyprofound/password-sync/server/storage"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Server struct {
	pgStore       *storage.PostgresStore
	authHandler   *handlers.AuthService
	syncHandler   *handlers.SyncHandler
	deviceHandler *handlers.DeviceHandler
	router        *gin.Engine
}

func NewServerWithAuth(pgStore *storage.PostgresStore) *Server {
	authHandler := handlers.NewAuthService(pgStore)
	syncHandler := handlers.NewSyncHandler(pgStore)
	deviceHandler := handlers.NewDeviceHandler(pgStore)

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:4200", "https://localhost:4200"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	s := &Server{
		pgStore:       pgStore,
		authHandler:   authHandler,
		syncHandler:   syncHandler,
		deviceHandler: deviceHandler,
		router:        router,
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	api := s.router.Group("/api/v1")

	// Public routes (no auth required)
	api.POST("/auth/register", s.authHandler.Register)
	api.POST("/auth/login", s.authHandler.Login)
	api.POST("/auth/refresh", s.authHandler.RefreshToken)

	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":     "ok",
			"mode":       "multi-tenant",
			"encryption": "zero-knowledge",
		})
	})

	// Protected routes (require JWT)
	protected := api.Group("/", middleware.AuthMiddleware())
	{
		// Sync endpoints (main functionality)
		protected.GET("/sync/manifest", s.syncHandler.GetManifest)
		protected.POST("/sync/pull", s.syncHandler.PullSync)
		protected.POST("/sync/push", s.syncHandler.PushSync)

		// Device management
		protected.GET("/devices", s.deviceHandler.ListDevices)
		protected.POST("/devices", s.deviceHandler.RegisterDevice)
	}
}

func (s *Server) Run(addr string) error {
	return s.router.Run(addr)
}
