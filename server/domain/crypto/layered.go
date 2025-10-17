package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"

	"golang.org/x/crypto/hkdf"
	"golang.org/x/crypto/pbkdf2"
)

type LayeredCrypto struct {
	masterKey []byte
}

func NewLayeredCrypto(password string, salt []byte) (*LayeredCrypto, error) {
	if len(salt) == 0 {
		salt = make([]byte, 32)
		if _, err := rand.Read(salt); err != nil {
			return nil, err
		}
	}

	masterKey := pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)

	return &LayeredCrypto{
		masterKey: masterKey,
	}, nil
}

func (lc *LayeredCrypto) WrapKey(contentKey []byte) ([]byte, error) {
	return lc.encrypt(contentKey, lc.masterKey)
}

func (lc *LayeredCrypto) UnwrapKey(wrappedKey []byte) ([]byte, error) {
	return lc.decrypt(wrappedKey, lc.masterKey)
}

func (lc *LayeredCrypto) EncryptItem(data []byte, contentKey []byte) ([]byte, error) {
	return lc.encrypt(data, contentKey)
}

func (lc *LayeredCrypto) DecryptItem(encData []byte, contentKey []byte) ([]byte, error) {
	return lc.decrypt(encData, contentKey)
}

func (lc *LayeredCrypto) EncryptCredential(data []byte) (wrappedKey, encItem []byte, err error) {
	contentKey := make([]byte, 32)
	if _, err := rand.Read(contentKey); err != nil {
		return nil, nil, err
	}

	wrappedKey, err = lc.WrapKey(contentKey)
	if err != nil {
		return nil, nil, err
	}

	encItem, err = lc.EncryptItem(data, contentKey)
	if err != nil {
		return nil, nil, err
	}

	return wrappedKey, encItem, nil
}

func (lc *LayeredCrypto) DecryptCredential(wrappedKey, encItem []byte) ([]byte, error) {
	contentKey, err := lc.UnwrapKey(wrappedKey)
	if err != nil {
		return nil, err
	}

	return lc.DecryptItem(encItem, contentKey)
}

func (lc *LayeredCrypto) DeriveSubKey(context string) ([]byte, error) {
	reader := hkdf.New(sha256.New, lc.masterKey, nil, []byte(context))
	key := make([]byte, 32)
	if _, err := reader.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}

func (lc *LayeredCrypto) encrypt(plaintext, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func (lc *LayeredCrypto) decrypt(ciphertext, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}

	nonce := ciphertext[:gcm.NonceSize()]
	ciphertext = ciphertext[gcm.NonceSize():]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func GenerateRandomKey(size int) ([]byte, error) {
	key := make([]byte, size)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}
