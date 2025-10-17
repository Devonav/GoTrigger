package peer

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"sync"
	"time"

	"github.com/deeplyprofound/password-sync/pkg/models"
)

type TrustLevel int

const (
	TrustLevelNone TrustLevel = iota
	TrustLevelPending
	TrustLevelTrusted
	TrustLevelRevoked
)

type PeerManager struct {
	mu         sync.RWMutex
	peers      map[string]*models.TrustedPeer
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	deviceID   string
}

func NewPeerManager(deviceID string) (*PeerManager, error) {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	pm := &PeerManager{
		peers:      make(map[string]*models.TrustedPeer),
		privateKey: privKey,
		publicKey:  pubKey,
		deviceID:   deviceID,
	}

	pm.peers[deviceID] = &models.TrustedPeer{
		PeerID:          deviceID,
		PublicKey:       pubKey,
		LastSeen:        time.Now(),
		IsCurrentDevice: true,
		TrustLevel:      int(TrustLevelTrusted),
	}

	return pm, nil
}

func (pm *PeerManager) GetDeviceID() string {
	return pm.deviceID
}

func (pm *PeerManager) GetPublicKey() ed25519.PublicKey {
	return pm.publicKey
}

func (pm *PeerManager) GenerateChallenge() ([]byte, error) {
	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		return nil, err
	}
	return challenge, nil
}

func (pm *PeerManager) SignChallenge(challenge []byte) ([]byte, error) {
	signature := ed25519.Sign(pm.privateKey, challenge)
	return signature, nil
}

func (pm *PeerManager) VerifyChallenge(challenge, signature []byte, publicKey ed25519.PublicKey) bool {
	return ed25519.Verify(publicKey, challenge, signature)
}

func (pm *PeerManager) EstablishTrust(peerID string, publicKey ed25519.PublicKey) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	challenge, err := pm.GenerateChallenge()
	if err != nil {
		return err
	}

	_ = challenge

	pm.peers[peerID] = &models.TrustedPeer{
		PeerID:          peerID,
		PublicKey:       publicKey,
		LastSeen:        time.Now(),
		IsCurrentDevice: false,
		TrustLevel:      int(TrustLevelTrusted),
	}

	return nil
}

func (pm *PeerManager) RevokeTrust(peerID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	peer, exists := pm.peers[peerID]
	if !exists {
		return errors.New("peer not found")
	}

	if peer.IsCurrentDevice {
		return errors.New("cannot revoke current device")
	}

	peer.TrustLevel = int(TrustLevelRevoked)
	return nil
}

func (pm *PeerManager) GetTrustedPeers() []*models.TrustedPeer {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var trusted []*models.TrustedPeer
	for _, peer := range pm.peers {
		if peer.TrustLevel == int(TrustLevelTrusted) {
			trusted = append(trusted, peer)
		}
	}

	return trusted
}

func (pm *PeerManager) IsPeerTrusted(peerID string) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	peer, exists := pm.peers[peerID]
	if !exists {
		return false
	}

	return peer.TrustLevel == int(TrustLevelTrusted)
}

func (pm *PeerManager) UpdatePeerActivity(peerID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	peer, exists := pm.peers[peerID]
	if !exists {
		return errors.New("peer not found")
	}

	peer.LastSeen = time.Now()
	return nil
}

func (pm *PeerManager) GetPeer(peerID string) (*models.TrustedPeer, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	peer, exists := pm.peers[peerID]
	if !exists {
		return nil, errors.New("peer not found")
	}

	return peer, nil
}

type PeerSyncMessage struct {
	FromPeerID string
	ToPeerID   string
	Timestamp  time.Time
	Data       []byte
	Signature  []byte
}

func (pm *PeerManager) SignMessage(msg *PeerSyncMessage) error {
	signature, err := pm.SignChallenge(msg.Data)
	if err != nil {
		return err
	}
	msg.Signature = signature
	return nil
}

func (pm *PeerManager) VerifyMessage(msg *PeerSyncMessage) error {
	peer, err := pm.GetPeer(msg.FromPeerID)
	if err != nil {
		return err
	}

	if !pm.VerifyChallenge(msg.Data, msg.Signature, peer.PublicKey) {
		return errors.New("invalid signature")
	}

	return nil
}
