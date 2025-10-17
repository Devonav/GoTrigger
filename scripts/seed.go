package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/deeplyprofound/password-sync/server/domain/auth"
	"github.com/deeplyprofound/password-sync/server/storage"
)

func main() {
	pgConn := flag.String("postgres", "postgres://localhost/password_sync?sslmode=disable", "Postgres connection string")
	flag.Parse()

	fmt.Println("🌱 Seeding database...")

	pgStore, err := storage.NewPostgresStore(*pgConn)
	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}
	defer pgStore.Close()

	// Seed test user
	testEmail := "test@example.com"
	testPassword := "password123"

	// Check if user exists
	existing, _ := pgStore.GetUserByEmail(testEmail)
	if existing != nil {
		fmt.Printf("✅ Test user already exists: %s\n", testEmail)
		fmt.Printf("   User ID: %s\n", existing.ID)
		return
	}

	// Create test user
	salt, err := auth.GenerateSalt()
	if err != nil {
		log.Fatalf("Failed to generate salt: %v", err)
	}

	passwordHash := auth.HashPassword(testPassword, salt)

	user, err := pgStore.CreateUser(testEmail, passwordHash, salt)
	if err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}

	fmt.Printf("✅ Created test user\n")
	fmt.Printf("   Email: %s\n", user.Email)
	fmt.Printf("   Password: %s\n", testPassword)
	fmt.Printf("   User ID: %s\n", user.ID)

	// Create test device
	device, err := pgStore.CreateDevice(user.ID, "Test Desktop", "desktop", nil)
	if err != nil {
		log.Fatalf("Failed to create device: %v", err)
	}

	fmt.Printf("✅ Created test device\n")
	fmt.Printf("   Device ID: %s\n", device.ID)
	fmt.Printf("   Device Name: %s\n", device.DeviceName)

	fmt.Println("\n🎉 Seeding complete!")
	fmt.Println("\nYou can now login with:")
	fmt.Printf("  Email: %s\n", testEmail)
	fmt.Printf("  Password: %s\n", testPassword)
}
