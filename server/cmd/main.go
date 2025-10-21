package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/deeplyprofound/password-sync/server/api"
	"github.com/deeplyprofound/password-sync/server/api/breach"
	"github.com/deeplyprofound/password-sync/server/domain/auth"
	"github.com/deeplyprofound/password-sync/server/storage"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	_ = godotenv.Load("server/.env")
	_ = godotenv.Load(".env")
	// Flags
	pgConn := flag.String("postgres", "", "Postgres connection string (REQUIRED: e.g. postgres://user:pass@localhost/password_sync)")
	port := flag.String("port", "8080", "Server port")
	jwtSecret := flag.String("jwt-secret", "", "JWT secret (defaults to env JWT_SECRET)")
	flag.Parse()

	// Set JWT secret from flag or env
	secret := *jwtSecret
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
	}
	if secret == "" {
		secret = "dev-secret-change-in-production"
		fmt.Println("WARNING: Using default JWT secret. Set JWT_SECRET in production!")
	}
	auth.SetJWTSecret([]byte(secret))

	// Initialize Postgres store (REQUIRED for multi-tenant server)
	if *pgConn == "" {
		log.Fatal("ERROR: Postgres connection string is required. Use -postgres flag or set POSTGRES_CONN env var.")
	}

	pgStore, err := storage.NewPostgresStore(*pgConn)
	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}
	defer pgStore.Close()

	// Initialize Redis for breach report caching
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	if err := breach.InitRedis(redisAddr); err != nil {
		fmt.Printf("WARNING: Redis not available - breach reports won't be cached: %v\n", err)
	} else {
		defer breach.CloseRedis()
	}

	// Create server with Postgres store
	server := api.NewServerWithAuth(pgStore)

	fmt.Printf("\n🚀 Starting Password Sync Server (Multi-Tenant)\n")
	fmt.Printf("   Port: %s\n", *port)
	fmt.Printf("   Postgres: Connected ✅\n")
	fmt.Printf("   Zero-Knowledge: Enabled ✅\n")
	fmt.Printf("\n")

	if err := server.Run(":" + *port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
