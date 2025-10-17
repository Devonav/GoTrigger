package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type KeyClass int

const (
	KeyClassSymmetric KeyClass = 0
	KeyClassPublic    KeyClass = 1
	KeyClassPrivate   KeyClass = 2
)

type KeyType int

const (
	KeyTypeAES256GCM KeyType = 0
	KeyTypeEd25519   KeyType = 1
	KeyTypeX25519    KeyType = 2
)

type KeyUsageFlags struct {
	Encrypt bool `json:"encrypt"`
	Decrypt bool `json:"decrypt"`
	Sign    bool `json:"sign"`
	Verify  bool `json:"verify"`
	Wrap    bool `json:"wrap"`
	Unwrap  bool `json:"unwrap"`
	Derive  bool `json:"derive"`
}

type CryptoKey struct {
	ID        uuid.UUID `db:"id" json:"id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	ItemUUID  uuid.UUID `db:"item_uuid" json:"item_uuid"`
	Zone      string    `db:"zone" json:"zone"`
	KeyClass  KeyClass  `db:"key_class" json:"key_class"`
	KeyType   KeyType   `db:"key_type" json:"key_type"`
	Label     *string   `db:"label" json:"label,omitempty"`
	AppLabel  *string   `db:"application_label" json:"application_label,omitempty"`
	AccGroup  string    `db:"access_group" json:"access_group"`
	Data      []byte    `db:"data" json:"data"`
	Flags     []byte    `db:"usage_flags" json:"usage_flags"`
	GenCount  int64     `db:"gencount" json:"gencount"`
	Tombstone bool      `db:"tombstone" json:"tombstone"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

func (k *CryptoKey) GetUsageFlags() (*KeyUsageFlags, error) {
	var flags KeyUsageFlags
	if err := json.Unmarshal(k.Flags, &flags); err != nil {
		return nil, err
	}
	return &flags, nil
}

func (k *CryptoKey) SetUsageFlags(flags KeyUsageFlags) error {
	data, err := json.Marshal(flags)
	if err != nil {
		return err
	}
	k.Flags = data
	return nil
}

type CredentialMetadata struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	UserID          uuid.UUID  `db:"user_id" json:"user_id"`
	ItemUUID        uuid.UUID  `db:"item_uuid" json:"item_uuid"`
	Zone            string     `db:"zone" json:"zone"`
	Server          string     `db:"server" json:"server"`
	Account         string     `db:"account" json:"account"`
	Protocol        int        `db:"protocol" json:"protocol"`
	Port            int        `db:"port" json:"port"`
	Path            *string    `db:"path" json:"path,omitempty"`
	Label           *string    `db:"label" json:"label,omitempty"`
	AccGroup        string     `db:"access_group" json:"access_group"`
	PasswordKeyUUID uuid.UUID  `db:"password_key_uuid" json:"password_key_uuid"`
	MetadataKeyUUID *uuid.UUID `db:"metadata_key_uuid" json:"metadata_key_uuid,omitempty"`
	GenCount        int64      `db:"gencount" json:"gencount"`
	Tombstone       bool       `db:"tombstone" json:"tombstone"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type SyncRecord struct {
	ID            uuid.UUID  `db:"id" json:"id"`
	UserID        uuid.UUID  `db:"user_id" json:"user_id"`
	ItemUUID      uuid.UUID  `db:"item_uuid" json:"item_uuid"`
	Zone          string     `db:"zone" json:"zone"`
	ParentKeyUUID *uuid.UUID `db:"parent_key_uuid" json:"parent_key_uuid,omitempty"`
	WrappedKey    []byte     `db:"wrapped_key" json:"wrapped_key"`
	EncItem       []byte     `db:"enc_item" json:"enc_item"`
	EncVersion    int        `db:"enc_version" json:"enc_version"`
	ContextID     string     `db:"context_id" json:"context_id"`
	GenCount      int64      `db:"gencount" json:"gencount"`
	Tombstone     bool       `db:"tombstone" json:"tombstone"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

func (s *SyncRecord) IsDeleted() bool {
	return s.Tombstone
}

func (s *SyncRecord) NeedsSync(lastGenCount int64) bool {
	return s.GenCount > lastGenCount
}

type SyncManifest struct {
	Zone      string    `db:"ckzone" json:"zone"`
	GenCount  int64     `db:"gencount" json:"gencount"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Digest    []byte    `db:"digest" json:"digest"`
	LeafIDs   []byte    `db:"leafIDs" json:"leaf_ids"`
}

func (m *SyncManifest) HasDiverged(otherDigest []byte) bool {
	if len(m.Digest) != len(otherDigest) {
		return true
	}
	for i := range m.Digest {
		if m.Digest[i] != otherDigest[i] {
			return true
		}
	}
	return false
}

func (m *SyncManifest) GetLeafIDsAsStrings() ([]string, error) {
	var leafIDs []string
	if len(m.LeafIDs) > 0 {
		if err := json.Unmarshal(m.LeafIDs, &leafIDs); err != nil {
			return nil, err
		}
	}
	return leafIDs, nil
}

type TrustedPeer struct {
	PeerID          string    `db:"peerID" json:"peer_id"`
	PublicKey       []byte    `db:"publicKey" json:"public_key"`
	LastSeen        time.Time `db:"lastSeen" json:"last_seen"`
	IsCurrentDevice bool      `db:"isCurrentDevice" json:"is_current_device"`
	TrustLevel      int       `db:"trustLevel" json:"trust_level"`
}
