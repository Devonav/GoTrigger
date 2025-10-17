package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"

	"crypto/sha256"
	"golang.org/x/crypto/pbkdf2"
)

const (
	SaltSize       = 32
	HashIterations = 100000 // PBKDF2 iterations for account password
	HashKeyLen     = 32     // Output key length
)

var (
	ErrInvalidPassword = errors.New("invalid password")
)

// GenerateSalt creates a random salt for password hashing
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltSize)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	return salt, nil
}

// HashPassword creates a PBKDF2 hash of the password with salt
// This is used for ACCOUNT authentication (login), NOT master password
func HashPassword(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, HashIterations, HashKeyLen, sha256.New)
}

// VerifyPassword checks if the provided password matches the stored hash
func VerifyPassword(password string, salt, hash []byte) bool {
	expectedHash := HashPassword(password, salt)
	return subtle.ConstantTimeCompare(expectedHash, hash) == 1
}

// EncodeToString encodes bytes to base64 string for storage
func EncodeToString(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// DecodeString decodes base64 string to bytes
func DecodeString(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}
