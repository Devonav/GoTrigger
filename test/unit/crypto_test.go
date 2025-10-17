package unit

import (
	"bytes"
	"testing"

	"github.com/deeplyprofound/password-sync/server/domain/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLayeredEncryption(t *testing.T) {
	salt := make([]byte, 32)
	lc, err := crypto.NewLayeredCrypto("test-password", salt)
	require.NoError(t, err)

	t.Run("encrypt and decrypt credential", func(t *testing.T) {
		plaintext := []byte("secret-passkey-data")

		wrappedKey, encItem, err := lc.EncryptCredential(plaintext)
		require.NoError(t, err)
		assert.NotEmpty(t, wrappedKey)
		assert.NotEmpty(t, encItem)

		decrypted, err := lc.DecryptCredential(wrappedKey, encItem)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("wrap and unwrap key", func(t *testing.T) {
		contentKey, err := crypto.GenerateRandomKey(32)
		require.NoError(t, err)

		wrapped, err := lc.WrapKey(contentKey)
		require.NoError(t, err)

		unwrapped, err := lc.UnwrapKey(wrapped)
		require.NoError(t, err)
		assert.Equal(t, contentKey, unwrapped)
	})

	t.Run("derive consistent subkeys", func(t *testing.T) {
		subKey1, err := lc.DeriveSubKey("test-context")
		require.NoError(t, err)

		subKey2, err := lc.DeriveSubKey("test-context")
		require.NoError(t, err)

		assert.True(t, bytes.Equal(subKey1, subKey2))

		subKey3, err := lc.DeriveSubKey("different-context")
		require.NoError(t, err)
		assert.False(t, bytes.Equal(subKey1, subKey3))
	})

	t.Run("encrypt item with content key", func(t *testing.T) {
		contentKey, err := crypto.GenerateRandomKey(32)
		require.NoError(t, err)

		plaintext := []byte("sensitive-data")

		encrypted, err := lc.EncryptItem(plaintext, contentKey)
		require.NoError(t, err)

		decrypted, err := lc.DecryptItem(encrypted, contentKey)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("different passwords produce different results", func(t *testing.T) {
		lc2, err := crypto.NewLayeredCrypto("different-password", salt)
		require.NoError(t, err)

		plaintext := []byte("data")
		wrappedKey1, encItem1, _ := lc.EncryptCredential(plaintext)
		wrappedKey2, encItem2, _ := lc2.EncryptCredential(plaintext)

		_, err = lc2.DecryptCredential(wrappedKey1, encItem1)
		assert.Error(t, err)

		_, err = lc.DecryptCredential(wrappedKey2, encItem2)
		assert.Error(t, err)
	})
}
