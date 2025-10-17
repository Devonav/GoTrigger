package unit

import (
	"crypto/ed25519"
	"testing"

	"github.com/deeplyprofound/password-sync/server/domain/peer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPeerManager(t *testing.T) {
	pm, err := peer.NewPeerManager("device-1")
	require.NoError(t, err)

	t.Run("initialize with current device", func(t *testing.T) {
		assert.Equal(t, "device-1", pm.GetDeviceID())
		assert.NotEmpty(t, pm.GetPublicKey())

		peers := pm.GetTrustedPeers()
		assert.Len(t, peers, 1)
		assert.Equal(t, "device-1", peers[0].PeerID)
		assert.True(t, peers[0].IsCurrentDevice)
	})

	t.Run("generate and sign challenge", func(t *testing.T) {
		challenge, err := pm.GenerateChallenge()
		require.NoError(t, err)
		assert.Len(t, challenge, 32)

		signature, err := pm.SignChallenge(challenge)
		require.NoError(t, err)
		assert.NotEmpty(t, signature)

		isValid := pm.VerifyChallenge(challenge, signature, pm.GetPublicKey())
		assert.True(t, isValid)
	})

	t.Run("establish trust with new peer", func(t *testing.T) {
		pubKey, _, err := ed25519.GenerateKey(nil)
		require.NoError(t, err)

		err = pm.EstablishTrust("device-2", pubKey)
		require.NoError(t, err)

		assert.True(t, pm.IsPeerTrusted("device-2"))

		peers := pm.GetTrustedPeers()
		assert.Len(t, peers, 2)
	})

	t.Run("revoke trust", func(t *testing.T) {
		pubKey, _, err := ed25519.GenerateKey(nil)
		require.NoError(t, err)

		err = pm.EstablishTrust("device-3", pubKey)
		require.NoError(t, err)
		assert.True(t, pm.IsPeerTrusted("device-3"))

		err = pm.RevokeTrust("device-3")
		require.NoError(t, err)
		assert.False(t, pm.IsPeerTrusted("device-3"))
	})

	t.Run("cannot revoke current device", func(t *testing.T) {
		err := pm.RevokeTrust("device-1")
		assert.Error(t, err)
	})

	t.Run("update peer activity", func(t *testing.T) {
		pubKey, _, err := ed25519.GenerateKey(nil)
		require.NoError(t, err)

		err = pm.EstablishTrust("device-4", pubKey)
		require.NoError(t, err)

		peer, err := pm.GetPeer("device-4")
		require.NoError(t, err)
		firstSeen := peer.LastSeen

		err = pm.UpdatePeerActivity("device-4")
		require.NoError(t, err)

		peer, err = pm.GetPeer("device-4")
		require.NoError(t, err)
		assert.True(t, peer.LastSeen.After(firstSeen))
	})

	t.Run("sign and verify message", func(t *testing.T) {
		pm2, err := peer.NewPeerManager("device-5")
		require.NoError(t, err)

		err = pm.EstablishTrust("device-5", pm2.GetPublicKey())
		require.NoError(t, err)

		msg := &peer.PeerSyncMessage{
			FromPeerID: "device-5",
			ToPeerID:   "device-1",
			Data:       []byte("sync-data"),
		}

		err = pm2.SignMessage(msg)
		require.NoError(t, err)

		err = pm.VerifyMessage(msg)
		assert.NoError(t, err)
	})

	t.Run("reject message from untrusted peer", func(t *testing.T) {
		pm2, err := peer.NewPeerManager("device-6")
		require.NoError(t, err)

		msg := &peer.PeerSyncMessage{
			FromPeerID: "device-6",
			ToPeerID:   "device-1",
			Data:       []byte("sync-data"),
		}

		err = pm2.SignMessage(msg)
		require.NoError(t, err)

		err = pm.VerifyMessage(msg)
		assert.Error(t, err)
	})
}
