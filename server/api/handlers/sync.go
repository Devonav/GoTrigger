package handlers

import (
	"net/http"

	"github.com/deeplyprofound/password-sync/pkg/models"
	"github.com/deeplyprofound/password-sync/server/domain/sync"
	"github.com/deeplyprofound/password-sync/server/storage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SyncHandler struct {
	pgStore *storage.PostgresStore
}

func NewSyncHandler(pgStore *storage.PostgresStore) *SyncHandler {
	return &SyncHandler{pgStore: pgStore}
}

func stringToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrToString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

type PullSyncRequest struct {
	Zone              string `json:"zone"`
	LastGenCount      int64  `json:"last_gencount"`
	IncludeTombstoned bool   `json:"include_tombstoned"`
}

type PushSyncRequest struct {
	Zone               string                  `json:"zone"`
	Keys               []CryptoKeyDTO          `json:"keys"`
	CredentialMetadata []CredentialMetadataDTO `json:"credential_metadata"`
	SyncRecords        []SyncRecordDTO         `json:"sync_records"`
}

type CryptoKeyDTO struct {
	ItemUUID  string `json:"item_uuid" binding:"required"`
	KeyClass  int    `json:"key_class" binding:"required"`
	KeyType   int    `json:"key_type" binding:"required"`
	Label     string `json:"label"`
	AppLabel  string `json:"application_label"`
	Data      []byte `json:"data" binding:"required"`
	Flags     []byte `json:"usage_flags" binding:"required"`
	AccGroup  string `json:"access_group"`
	GenCount  int64  `json:"gencount"`
	Tombstone bool   `json:"tombstone"`
}

type CredentialMetadataDTO struct {
	ItemUUID        string `json:"item_uuid" binding:"required"`
	Server          string `json:"server" binding:"required"`
	Account         string `json:"account" binding:"required"`
	Protocol        int    `json:"protocol"`
	Port            int    `json:"port"`
	Path            string `json:"path"`
	Label           string `json:"label"`
	AccGroup        string `json:"access_group"`
	PasswordKeyUUID string `json:"password_key_uuid" binding:"required"`
	MetadataKeyUUID string `json:"metadata_key_uuid"`
	GenCount        int64  `json:"gencount"`
	Tombstone       bool   `json:"tombstone"`
}

type SyncRecordDTO struct {
	ItemUUID      string `json:"item_uuid" binding:"required"`
	ParentKeyUUID string `json:"parent_key_uuid"`
	WrappedKey    []byte `json:"wrapped_key" binding:"required"`
	EncItem       []byte `json:"enc_item" binding:"required"`
	EncVersion    int    `json:"enc_version"`
	ContextID     string `json:"context_id"`
	GenCount      int64  `json:"gencount"`
	Tombstone     bool   `json:"tombstone"`
}

func (h *SyncHandler) GetManifest(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	zone := c.DefaultQuery("zone", "default")

	syncState, err := h.pgStore.GetSyncState(userID.(string), zone)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"zone":      zone,
			"gencount":  0,
			"digest":    nil,
			"signer_id": "",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"zone":      syncState.Zone,
		"gencount":  syncState.GenCount,
		"digest":    syncState.Digest,
		"signer_id": "",
	})
}

func (h *SyncHandler) PullSync(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var req PullSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Zone == "" {
		req.Zone = "default"
	}

	// Use filtered queries to exclude tombstoned records unless explicitly requested
	cryptoKeys, err := h.pgStore.GetCryptoKeysByUserWithFilter(userID.(string), req.Zone, req.LastGenCount, req.IncludeTombstoned)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get crypto keys: " + err.Error()})
		return
	}

	credMetadata, err := h.pgStore.GetCredentialMetadataByUserWithFilter(userID.(string), req.Zone, req.LastGenCount, req.IncludeTombstoned)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get credential metadata: " + err.Error()})
		return
	}

	syncRecords, err := h.pgStore.GetSyncRecordsByUserWithFilter(userID.(string), req.Zone, req.LastGenCount, req.IncludeTombstoned)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get sync records: " + err.Error()})
		return
	}

	syncState, err := h.pgStore.GetSyncState(userID.(string), req.Zone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var keys []gin.H
	for _, key := range cryptoKeys {
		keys = append(keys, gin.H{
			"item_uuid":         key.ItemUUID.String(),
			"key_class":         int(key.KeyClass),
			"key_type":          int(key.KeyType),
			"label":             ptrToString(key.Label),
			"application_label": ptrToString(key.AppLabel),
			"data":              key.Data,
			"usage_flags":       key.Flags,
			"access_group":      key.AccGroup,
			"gencount":          key.GenCount,
			"tombstone":         key.Tombstone,
		})
	}

	var metadata []gin.H
	for _, cred := range credMetadata {
		var metadataKeyUUID *string
		if cred.MetadataKeyUUID != nil {
			s := cred.MetadataKeyUUID.String()
			metadataKeyUUID = &s
		}

		metadata = append(metadata, gin.H{
			"item_uuid":         cred.ItemUUID.String(),
			"server":            cred.Server,
			"account":           cred.Account,
			"protocol":          cred.Protocol,
			"port":              cred.Port,
			"path":              ptrToString(cred.Path),
			"label":             ptrToString(cred.Label),
			"access_group":      cred.AccGroup,
			"password_key_uuid": cred.PasswordKeyUUID.String(),
			"metadata_key_uuid": metadataKeyUUID,
			"gencount":          cred.GenCount,
			"tombstone":         cred.Tombstone,
		})
	}

	var records []gin.H
	for _, record := range syncRecords {
		var parentKeyUUID *string
		if record.ParentKeyUUID != nil {
			s := record.ParentKeyUUID.String()
			parentKeyUUID = &s
		}

		records = append(records, gin.H{
			"item_uuid":       record.ItemUUID.String(),
			"parent_key_uuid": parentKeyUUID,
			"wrapped_key":     record.WrappedKey,
			"enc_item":        record.EncItem,
			"enc_version":     record.EncVersion,
			"context_id":      record.ContextID,
			"gencount":        record.GenCount,
			"tombstone":       record.Tombstone,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"keys":                keys,
		"credential_metadata": metadata,
		"sync_records":        records,
		"gencount":            syncState.GenCount,
	})
}

func (h *SyncHandler) DeleteAllCredentials(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	zone := c.DefaultQuery("zone", "default")

	// Get all credential metadata for this user
	credMetadata, err := h.pgStore.GetCredentialMetadataByUser(userID.(string), zone, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get credentials: " + err.Error()})
		return
	}

	// Get all crypto keys for this user
	cryptoKeys, err := h.pgStore.GetCryptoKeysByUser(userID.(string), zone, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get crypto keys: " + err.Error()})
		return
	}

	// Get all sync records for this user
	syncRecords, err := h.pgStore.GetSyncRecordsByUser(userID.(string), zone, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get sync records: " + err.Error()})
		return
	}

	syncState, err := h.pgStore.GetSyncState(userID.(string), zone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	currentGenCount := syncState.GenCount
	var deletedCount int

	// Mark all credential metadata as tombstoned
	for i := range credMetadata {
		credMetadata[i].Tombstone = true
		currentGenCount++
		credMetadata[i].GenCount = currentGenCount

		if err := h.pgStore.CreateCredentialMetadata(userID.(string), credMetadata[i].ItemUUID.String(), credMetadata[i]); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to tombstone credential: " + err.Error()})
			return
		}
		deletedCount++
	}

	// Mark all crypto keys as tombstoned
	for i := range cryptoKeys {
		cryptoKeys[i].Tombstone = true
		currentGenCount++
		cryptoKeys[i].GenCount = currentGenCount

		if err := h.pgStore.CreateCryptoKey(userID.(string), cryptoKeys[i].ItemUUID.String(), cryptoKeys[i]); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to tombstone key: " + err.Error()})
			return
		}
		deletedCount++
	}

	// Mark all sync records as tombstoned
	for i := range syncRecords {
		syncRecords[i].Tombstone = true
		currentGenCount++
		syncRecords[i].GenCount = currentGenCount

		if err := h.pgStore.CreateSyncRecord(userID.(string), syncRecords[i].ItemUUID.String(), syncRecords[i]); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to tombstone sync record: " + err.Error()})
			return
		}
		deletedCount++
	}

	// Update sync state
	syncEngine := sync.NewSyncEngine(zone)
	digest := syncEngine.UpdateManifestDigest([]string{}) // Empty manifest since all deleted

	if err := h.pgStore.UpsertSyncState(userID.(string), zone, currentGenCount, digest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"gencount": currentGenCount,
		"deleted":  deletedCount,
		"message":  "All credentials marked as deleted",
	})
}

func (h *SyncHandler) PushSync(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	var req PushSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Zone == "" {
		req.Zone = "default"
	}

	syncState, err := h.pgStore.GetSyncState(userID.(string), req.Zone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	currentGenCount := syncState.GenCount
	var pushedCount int

	// Triple-layer architecture: Process Keys, Metadata, and Sync Records

	// Layer 1: Process CryptoKeys
	for _, keyDTO := range req.Keys {
		currentGenCount++

		itemID, _ := uuid.Parse(keyDTO.ItemUUID)
		userIDParsed, _ := uuid.Parse(userID.(string))

		key := &models.CryptoKey{
			UserID:    userIDParsed,
			ItemUUID:  itemID,
			Zone:      req.Zone,
			KeyClass:  models.KeyClass(keyDTO.KeyClass),
			KeyType:   models.KeyType(keyDTO.KeyType),
			Label:     stringToPtr(keyDTO.Label),
			AppLabel:  stringToPtr(keyDTO.AppLabel),
			Data:      keyDTO.Data,
			Flags:     keyDTO.Flags,
			AccGroup:  keyDTO.AccGroup,
			GenCount:  currentGenCount,
			Tombstone: keyDTO.Tombstone,
		}

		if key.AccGroup == "" {
			key.AccGroup = "default"
		}

		if err := h.pgStore.CreateCryptoKey(userID.(string), keyDTO.ItemUUID, key); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create crypto key: " + err.Error()})
			return
		}

		pushedCount++
	}

	// Layer 2: Process CredentialMetadata
	for _, credDTO := range req.CredentialMetadata {
		currentGenCount++

		itemID, _ := uuid.Parse(credDTO.ItemUUID)
		userIDParsed, _ := uuid.Parse(userID.(string))
		passwordKeyID, _ := uuid.Parse(credDTO.PasswordKeyUUID)

		var metadataKeyID *uuid.UUID
		if credDTO.MetadataKeyUUID != "" {
			parsed, _ := uuid.Parse(credDTO.MetadataKeyUUID)
			metadataKeyID = &parsed
		}

		cred := &models.CredentialMetadata{
			UserID:          userIDParsed,
			ItemUUID:        itemID,
			Zone:            req.Zone,
			Server:          credDTO.Server,
			Account:         credDTO.Account,
			Protocol:        credDTO.Protocol,
			Port:            credDTO.Port,
			Path:            stringToPtr(credDTO.Path),
			Label:           stringToPtr(credDTO.Label),
			AccGroup:        credDTO.AccGroup,
			PasswordKeyUUID: passwordKeyID,
			MetadataKeyUUID: metadataKeyID,
			GenCount:        currentGenCount,
			Tombstone:       credDTO.Tombstone,
		}

		if cred.AccGroup == "" {
			cred.AccGroup = "default"
		}
		if cred.Protocol == 0 {
			cred.Protocol = 443
		}
		if cred.Port == 0 {
			cred.Port = 443
		}

		if err := h.pgStore.CreateCredentialMetadata(userID.(string), credDTO.ItemUUID, cred); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create credential metadata: " + err.Error()})
			return
		}

		pushedCount++
	}

	// Layer 3: Process SyncRecords (encrypted blobs for sync)
	for _, dto := range req.SyncRecords {
		currentGenCount++

		var parentKeyUUID *uuid.UUID
		if dto.ParentKeyUUID != "" {
			parsed, _ := uuid.Parse(dto.ParentKeyUUID)
			parentKeyUUID = &parsed
		}

		itemID, _ := uuid.Parse(dto.ItemUUID)
		userIDParsed, _ := uuid.Parse(userID.(string))

		record := &models.SyncRecord{
			UserID:        userIDParsed,
			ItemUUID:      itemID,
			Zone:          req.Zone,
			ParentKeyUUID: parentKeyUUID,
			WrappedKey:    dto.WrappedKey,
			EncItem:       dto.EncItem,
			EncVersion:    dto.EncVersion,
			ContextID:     dto.ContextID,
			GenCount:      currentGenCount,
			Tombstone:     dto.Tombstone,
		}

		if record.ContextID == "" {
			record.ContextID = "default"
		}
		if record.EncVersion == 0 {
			record.EncVersion = 1
		}

		if err := h.pgStore.CreateSyncRecord(userID.(string), dto.ItemUUID, record); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create sync record: " + err.Error()})
			return
		}

		pushedCount++
	}

	// Calculate manifest digest for quick sync check
	allRecords, err := h.pgStore.GetAllSyncRecordsByUser(userID.(string), req.Zone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	syncEngine := sync.NewSyncEngine(req.Zone)
	leafIDs := make([]string, 0, len(allRecords))
	for _, record := range allRecords {
		if !record.Tombstone {
			leafIDs = append(leafIDs, record.ItemUUID.String())
		}
	}
	digest := syncEngine.UpdateManifestDigest(leafIDs)

	if err := h.pgStore.UpsertSyncState(userID.(string), req.Zone, currentGenCount, digest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"gencount": currentGenCount,
		"synced":   pushedCount,
	})
}
