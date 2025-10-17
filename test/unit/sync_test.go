package unit

import (
	"testing"

	"github.com/deeplyprofound/password-sync/pkg/models"
	"github.com/deeplyprofound/password-sync/server/domain/sync"
	"github.com/stretchr/testify/assert"
)

func TestSyncEngine(t *testing.T) {
	engine := sync.NewSyncEngine("test-zone")

	t.Run("increment generation count", func(t *testing.T) {
		initial := engine.GetCurrentGenCount()
		gen1 := engine.IncrementGenCount()
		gen2 := engine.IncrementGenCount()

		assert.Equal(t, initial+1, gen1)
		assert.Equal(t, initial+2, gen2)
		assert.Equal(t, gen2, engine.GetCurrentGenCount())
	})

	t.Run("update manifest digest", func(t *testing.T) {
		leafIDs := []string{"uuid1", "uuid2", "uuid3"}
		digest1 := engine.UpdateManifestDigest(leafIDs)
		assert.NotEmpty(t, digest1)

		digest2 := engine.UpdateManifestDigest(leafIDs)
		assert.Equal(t, digest1, digest2)

		differentLeafIDs := []string{"uuid1", "uuid2", "uuid4"}
		digest3 := engine.UpdateManifestDigest(differentLeafIDs)
		assert.NotEqual(t, digest1, digest3)
	})

	t.Run("detect conflicts", func(t *testing.T) {
		local := &models.SyncRecord{
			UUID:          "test-uuid",
			GenCount:      5,
			ParentKeyUUID: "parent1",
		}

		remote1 := &models.SyncRecord{
			UUID:          "test-uuid",
			GenCount:      5,
			ParentKeyUUID: "parent1",
		}
		assert.False(t, engine.DetectConflict(local, remote1))

		remote2 := &models.SyncRecord{
			UUID:          "test-uuid",
			GenCount:      5,
			ParentKeyUUID: "parent2",
		}
		assert.True(t, engine.DetectConflict(local, remote2))

		remote3 := &models.SyncRecord{
			UUID:          "test-uuid",
			GenCount:      6,
			ParentKeyUUID: "parent1",
		}
		assert.True(t, engine.DetectConflict(local, remote3))
	})

	t.Run("resolve conflicts with last write wins", func(t *testing.T) {
		local := &models.SyncRecord{UUID: "test", GenCount: 5}
		remote := &models.SyncRecord{UUID: "test", GenCount: 3}

		resolved, err := engine.ResolveConflict(local, remote)
		assert.NoError(t, err)
		assert.Equal(t, local, resolved)

		resolved, err = engine.ResolveConflict(remote, local)
		assert.NoError(t, err)
		assert.Equal(t, local, resolved)
	})

	t.Run("create sync operation", func(t *testing.T) {
		op := engine.CreateSyncOperation("test-uuid", 4)

		assert.Equal(t, "test-uuid", op.UUID)
		assert.Greater(t, op.GenCount, int64(0))
		assert.Equal(t, int64(4), op.PreviousGenCount)
		assert.False(t, op.Tombstone)
	})

	t.Run("mark tombstone", func(t *testing.T) {
		op := engine.MarkTombstone("deleted-uuid")

		assert.Equal(t, "deleted-uuid", op.UUID)
		assert.True(t, op.Tombstone)
	})

	t.Run("compute manifest diff", func(t *testing.T) {
		local := []string{"uuid1", "uuid2", "uuid3"}
		remote := []string{"uuid2", "uuid3", "uuid4", "uuid5"}

		diff := engine.ComputeManifestDiff(local, remote)

		assert.Contains(t, diff.Added, "uuid4")
		assert.Contains(t, diff.Added, "uuid5")
		assert.Contains(t, diff.Removed, "uuid1")
	})

	t.Run("detect divergence", func(t *testing.T) {
		digest1 := []byte{1, 2, 3, 4}
		digest2 := []byte{1, 2, 3, 4}
		digest3 := []byte{1, 2, 3, 5}

		assert.False(t, engine.HasDiverged(digest1, digest2))
		assert.True(t, engine.HasDiverged(digest1, digest3))
	})

	t.Run("build manifest", func(t *testing.T) {
		leafIDs := []string{"uuid1", "uuid2", "uuid3"}
		manifest, err := engine.BuildManifest(leafIDs, 10)

		assert.NoError(t, err)
		assert.Equal(t, "test-zone", manifest.Zone)
		assert.Equal(t, int64(10), manifest.GenCount)
		assert.NotEmpty(t, manifest.Digest)
		assert.NotEmpty(t, manifest.LeafIDs)
	})
}
