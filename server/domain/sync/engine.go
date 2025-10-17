package sync

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/deeplyprofound/password-sync/pkg/models"
)

type ConflictResolutionStrategy int

const (
	LastWriteWins ConflictResolutionStrategy = iota
	HighestGenCountWins
	ManualResolve
)

type SyncEngine struct {
	mu              sync.RWMutex
	currentGenCount int64
	manifestDigest  []byte
	leafIDs         []string
	zone            string
	strategy        ConflictResolutionStrategy
}

func NewSyncEngine(zone string) *SyncEngine {
	return &SyncEngine{
		currentGenCount: 0,
		zone:            zone,
		strategy:        LastWriteWins,
		leafIDs:         make([]string, 0),
	}
}

func (se *SyncEngine) IncrementGenCount() int64 {
	se.mu.Lock()
	defer se.mu.Unlock()

	se.currentGenCount++
	return se.currentGenCount
}

func (se *SyncEngine) GetCurrentGenCount() int64 {
	se.mu.RLock()
	defer se.mu.RUnlock()
	return se.currentGenCount
}

// UpdateManifestDigest calculates a Merkle-tree style digest from leaf IDs
// This implements Apple's pattern for quick divergence detection
// The digest is a SHA-256 hash of all leaf IDs sorted alphabetically
func (se *SyncEngine) UpdateManifestDigest(leafIDs []string) []byte {
	se.mu.Lock()
	defer se.mu.Unlock()

	se.leafIDs = leafIDs

	// Sort leaf IDs for consistent digest calculation
	sortedIDs := make([]string, len(leafIDs))
	copy(sortedIDs, leafIDs)
	sortStrings(sortedIDs)

	hasher := sha256.New()
	for _, id := range sortedIDs {
		hasher.Write([]byte(id))
		hasher.Write([]byte("|")) // Separator to prevent collision
	}

	se.manifestDigest = hasher.Sum(nil)
	return se.manifestDigest
}

// Helper function to sort strings
func sortStrings(strs []string) {
	n := len(strs)
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			if strs[i] > strs[j] {
				strs[i], strs[j] = strs[j], strs[i]
			}
		}
	}
}

func (se *SyncEngine) DetectConflict(localRecord, remoteRecord *models.SyncRecord) bool {
	if localRecord.GenCount == remoteRecord.GenCount {
		return localRecord.ParentKeyUUID != remoteRecord.ParentKeyUUID
	}

	return true
}

func (se *SyncEngine) ResolveConflict(local, remote *models.SyncRecord) (*models.SyncRecord, error) {
	switch se.strategy {
	case LastWriteWins:
		if local.GenCount > remote.GenCount {
			return local, nil
		}
		return remote, nil

	case HighestGenCountWins:
		if local.GenCount >= remote.GenCount {
			return local, nil
		}
		return remote, nil

	case ManualResolve:
		return nil, errors.New("manual conflict resolution required")

	default:
		return local, nil
	}
}

func (se *SyncEngine) CreateSyncOperation(uuid string, previousGen int64) *SyncOperation {
	genCount := se.IncrementGenCount()

	return &SyncOperation{
		UUID:             uuid,
		GenCount:         genCount,
		PreviousGenCount: previousGen,
		Timestamp:        time.Now(),
		Tombstone:        false,
	}
}

func (se *SyncEngine) MarkTombstone(uuid string) *SyncOperation {
	genCount := se.IncrementGenCount()

	return &SyncOperation{
		UUID:      uuid,
		GenCount:  genCount,
		Timestamp: time.Now(),
		Tombstone: true,
	}
}

type SyncOperation struct {
	UUID             string
	GenCount         int64
	PreviousGenCount int64
	Timestamp        time.Time
	Tombstone        bool
}

type ManifestDiff struct {
	Added    []string
	Removed  []string
	Modified []string
}

// ComputeManifestDiff calculates the symmetric difference between local and remote leaf IDs
// This tells us exactly which items were added, removed, or potentially modified
// Only called if HasDiverged returns true (digests don't match)
func (se *SyncEngine) ComputeManifestDiff(localLeafIDs, remoteLeafIDs []string) *ManifestDiff {
	localSet := make(map[string]bool)
	remoteSet := make(map[string]bool)

	for _, id := range localLeafIDs {
		localSet[id] = true
	}

	for _, id := range remoteLeafIDs {
		remoteSet[id] = true
	}

	diff := &ManifestDiff{
		Added:    make([]string, 0),
		Removed:  make([]string, 0),
		Modified: make([]string, 0),
	}

	// Items in remote but not in local = Added
	for id := range remoteSet {
		if !localSet[id] {
			diff.Added = append(diff.Added, id)
		}
	}

	// Items in local but not in remote = Removed
	for id := range localSet {
		if !remoteSet[id] {
			diff.Removed = append(diff.Removed, id)
		}
	}

	// Items in both sets might be modified (check gencount separately)
	for id := range localSet {
		if remoteSet[id] {
			diff.Modified = append(diff.Modified, id)
		}
	}

	return diff
}

// HasDiverged compares two manifest digests to determine if sync is needed
// This is an O(1) operation (just comparing 32-byte SHA-256 hashes)
// Much faster than comparing all records individually
func (se *SyncEngine) HasDiverged(localDigest, remoteDigest []byte) bool {
	// If either digest is nil or empty, divergence check required
	if len(localDigest) == 0 || len(remoteDigest) == 0 {
		return true
	}

	if len(localDigest) != len(remoteDigest) {
		return true
	}

	for i := range localDigest {
		if localDigest[i] != remoteDigest[i] {
			return true
		}
	}

	return false
}

// BuildManifest creates a SyncManifest from a list of leaf IDs and gencount
// This is the complete manifest that includes the Merkle digest
func (se *SyncEngine) BuildManifest(leafIDs []string, genCount int64) (*models.SyncManifest, error) {
	digest := se.UpdateManifestDigest(leafIDs)

	leafIDsJSON, err := json.Marshal(leafIDs)
	if err != nil {
		return nil, err
	}

	return &models.SyncManifest{
		Zone:      se.zone,
		GenCount:  genCount,
		Digest:    digest,
		LeafIDs:   leafIDsJSON,
		UpdatedAt: time.Now(),
	}, nil
}

// CalculateDigestFromRecords is a convenience function to calculate digest from sync records
// Useful when you have records but not leaf IDs yet
func (se *SyncEngine) CalculateDigestFromRecords(records []*models.SyncRecord) []byte {
	leafIDs := make([]string, 0, len(records))
	for _, record := range records {
		if !record.IsDeleted() {
			leafIDs = append(leafIDs, record.ItemUUID.String())
		}
	}
	return se.UpdateManifestDigest(leafIDs)
}

// QuickSyncCheck performs a fast O(1) check to see if sync is needed
// Returns true if sync is required, false if everything is up to date
func QuickSyncCheck(localDigest, remoteDigest []byte) bool {
	if len(localDigest) == 0 || len(remoteDigest) == 0 {
		return true // No digest means sync needed
	}

	if len(localDigest) != len(remoteDigest) {
		return true
	}

	for i := range localDigest {
		if localDigest[i] != remoteDigest[i] {
			return true // Digests differ, sync needed
		}
	}

	return false // Digests match, no sync needed
}
