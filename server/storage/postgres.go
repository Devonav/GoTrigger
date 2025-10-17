package storage

import (
	"database/sql"
	"time"

	"github.com/deeplyprofound/password-sync/pkg/models"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(connString string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", connString)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &PostgresStore{db: db}, nil
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

// User models and methods

type User struct {
	ID               string
	Email            string
	PasswordHash     []byte
	Salt             []byte
	CreatedAt        time.Time
	UpdatedAt        time.Time
	SubscriptionTier string
	EmailVerified    bool
}

func (s *PostgresStore) CreateUser(email string, passwordHash, salt []byte) (*User, error) {
	user := &User{
		ID:               uuid.New().String(),
		Email:            email,
		PasswordHash:     passwordHash,
		Salt:             salt,
		SubscriptionTier: "free",
		EmailVerified:    false,
	}

	query := `
		INSERT INTO users (id, email, password_hash, salt, subscription_tier, email_verified)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`

	err := s.db.QueryRow(query,
		user.ID, user.Email, user.PasswordHash, user.Salt,
		user.SubscriptionTier, user.EmailVerified,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *PostgresStore) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	query := `
		SELECT id, email, password_hash, salt, created_at, updated_at, 
		       subscription_tier, email_verified
		FROM users WHERE email = $1
	`

	err := s.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Salt,
		&user.CreatedAt, &user.UpdatedAt, &user.SubscriptionTier,
		&user.EmailVerified,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *PostgresStore) GetUserByID(id string) (*User, error) {
	user := &User{}
	query := `
		SELECT id, email, password_hash, salt, created_at, updated_at,
		       subscription_tier, email_verified
		FROM users WHERE id = $1
	`

	err := s.db.QueryRow(query, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Salt,
		&user.CreatedAt, &user.UpdatedAt, &user.SubscriptionTier,
		&user.EmailVerified,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

// Device models and methods

type Device struct {
	ID         string
	UserID     string
	DeviceName string
	DeviceType string
	PublicKey  []byte
	LastSync   *time.Time
	CreatedAt  time.Time
	IsActive   bool
}

func (s *PostgresStore) CreateDevice(userID, deviceName, deviceType string, publicKey []byte) (*Device, error) {
	device := &Device{
		ID:         uuid.New().String(),
		UserID:     userID,
		DeviceName: deviceName,
		DeviceType: deviceType,
		PublicKey:  publicKey,
		IsActive:   true,
	}

	query := `
		INSERT INTO devices (id, user_id, device_name, device_type, public_key, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at
	`

	err := s.db.QueryRow(query,
		device.ID, device.UserID, device.DeviceName,
		device.DeviceType, device.PublicKey, device.IsActive,
	).Scan(&device.CreatedAt)

	if err != nil {
		return nil, err
	}

	return device, nil
}

func (s *PostgresStore) GetDevicesByUserID(userID string) ([]*Device, error) {
	query := `
		SELECT id, user_id, device_name, device_type, public_key, 
		       last_sync, created_at, is_active
		FROM devices WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []*Device
	for rows.Next() {
		device := &Device{}
		err := rows.Scan(
			&device.ID, &device.UserID, &device.DeviceName,
			&device.DeviceType, &device.PublicKey, &device.LastSync,
			&device.CreatedAt, &device.IsActive,
		)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}

	return devices, nil
}

func (s *PostgresStore) UpdateDeviceLastSync(deviceID string) error {
	query := `UPDATE devices SET last_sync = $1 WHERE id = $2`
	_, err := s.db.Exec(query, time.Now(), deviceID)
	return err
}

// Sync state methods

type SyncState struct {
	UserID    string
	Zone      string
	GenCount  int64
	Digest    []byte
	UpdatedAt time.Time
}

func (s *PostgresStore) GetSyncState(userID, zone string) (*SyncState, error) {
	state := &SyncState{}
	query := `
		SELECT user_id, zone, gencount, digest, updated_at
		FROM sync_state WHERE user_id = $1 AND zone = $2
	`

	err := s.db.QueryRow(query, userID, zone).Scan(
		&state.UserID, &state.Zone, &state.GenCount,
		&state.Digest, &state.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return &SyncState{
			UserID:   userID,
			Zone:     zone,
			GenCount: 0,
		}, nil
	}

	if err != nil {
		return nil, err
	}

	return state, nil
}

func (s *PostgresStore) UpsertSyncState(userID, zone string, genCount int64, digest []byte) error {
	query := `
		INSERT INTO sync_state (user_id, zone, gencount, digest)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, zone) DO UPDATE SET
			gencount = EXCLUDED.gencount,
			digest = EXCLUDED.digest,
			updated_at = NOW()
	`

	_, err := s.db.Exec(query, userID, zone, genCount, digest)
	return err
}

// Triple-layer architecture storage methods

func (s *PostgresStore) CreateCryptoKey(userID, itemUUID string, key *models.CryptoKey) error {
	query := `
		INSERT INTO crypto_keys (id, user_id, item_uuid, zone, key_class, key_type, 
			label, application_label, access_group, data, usage_flags, gencount, tombstone)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (user_id, item_uuid, zone) DO UPDATE SET
			data = EXCLUDED.data,
			usage_flags = EXCLUDED.usage_flags,
			gencount = EXCLUDED.gencount,
			tombstone = EXCLUDED.tombstone
		RETURNING created_at, updated_at
	`

	keyID := uuid.New()
	itemID, _ := uuid.Parse(itemUUID)
	userIDParsed, _ := uuid.Parse(userID)

	err := s.db.QueryRow(query,
		keyID, userIDParsed, itemID, key.Zone, key.KeyClass, key.KeyType,
		key.Label, key.AppLabel, key.AccGroup, key.Data, key.Flags,
		key.GenCount, key.Tombstone,
	).Scan(&key.CreatedAt, &key.UpdatedAt)

	return err
}

func (s *PostgresStore) GetCryptoKeysByUser(userID, zone string, sinceGenCount int64) ([]*models.CryptoKey, error) {
	return s.GetCryptoKeysByUserWithFilter(userID, zone, sinceGenCount, true)
}

func (s *PostgresStore) GetCryptoKeysByUserWithFilter(userID, zone string, sinceGenCount int64, includeTombstoned bool) ([]*models.CryptoKey, error) {
	query := `
		SELECT id, user_id, item_uuid, zone, key_class, key_type, label,
		       application_label, access_group, data, usage_flags, gencount,
		       tombstone, created_at, updated_at
		FROM crypto_keys
		WHERE user_id = $1 AND zone = $2 AND gencount > $3 AND (tombstone = false OR $4 = true)
		ORDER BY gencount ASC
	`

	rows, err := s.db.Query(query, userID, zone, sinceGenCount, includeTombstoned)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.CryptoKey
	for rows.Next() {
		key := &models.CryptoKey{}
		err := rows.Scan(
			&key.ID, &key.UserID, &key.ItemUUID, &key.Zone, &key.KeyClass,
			&key.KeyType, &key.Label, &key.AppLabel, &key.AccGroup, &key.Data,
			&key.Flags, &key.GenCount, &key.Tombstone, &key.CreatedAt, &key.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}

	return keys, nil
}

func (s *PostgresStore) CreateCredentialMetadata(userID, itemUUID string, cred *models.CredentialMetadata) error {
	query := `
		INSERT INTO credential_metadata (id, user_id, item_uuid, zone, server, account,
			protocol, port, path, label, access_group, password_key_uuid, metadata_key_uuid,
			gencount, tombstone)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (user_id, item_uuid, zone) DO UPDATE SET
			server = EXCLUDED.server,
			account = EXCLUDED.account,
			password_key_uuid = EXCLUDED.password_key_uuid,
			gencount = EXCLUDED.gencount,
			tombstone = EXCLUDED.tombstone
		RETURNING created_at, updated_at
	`

	credID := uuid.New()
	itemID, _ := uuid.Parse(itemUUID)
	userIDParsed, _ := uuid.Parse(userID)

	err := s.db.QueryRow(query,
		credID, userIDParsed, itemID, cred.Zone, cred.Server, cred.Account,
		cred.Protocol, cred.Port, cred.Path, cred.Label, cred.AccGroup,
		cred.PasswordKeyUUID, cred.MetadataKeyUUID, cred.GenCount, cred.Tombstone,
	).Scan(&cred.CreatedAt, &cred.UpdatedAt)

	return err
}

func (s *PostgresStore) GetCredentialMetadataByUser(userID, zone string, sinceGenCount int64) ([]*models.CredentialMetadata, error) {
	return s.GetCredentialMetadataByUserWithFilter(userID, zone, sinceGenCount, true)
}

func (s *PostgresStore) GetCredentialMetadataByUserWithFilter(userID, zone string, sinceGenCount int64, includeTombstoned bool) ([]*models.CredentialMetadata, error) {
	query := `
		SELECT id, user_id, item_uuid, zone, server, account, protocol, port,
		       path, label, access_group, password_key_uuid, metadata_key_uuid,
		       gencount, tombstone, created_at, updated_at
		FROM credential_metadata
		WHERE user_id = $1 AND zone = $2 AND gencount > $3 AND (tombstone = false OR $4 = true)
		ORDER BY gencount ASC
	`

	rows, err := s.db.Query(query, userID, zone, sinceGenCount, includeTombstoned)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var creds []*models.CredentialMetadata
	for rows.Next() {
		cred := &models.CredentialMetadata{}
		err := rows.Scan(
			&cred.ID, &cred.UserID, &cred.ItemUUID, &cred.Zone, &cred.Server,
			&cred.Account, &cred.Protocol, &cred.Port, &cred.Path, &cred.Label,
			&cred.AccGroup, &cred.PasswordKeyUUID, &cred.MetadataKeyUUID,
			&cred.GenCount, &cred.Tombstone, &cred.CreatedAt, &cred.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		creds = append(creds, cred)
	}

	return creds, nil
}

func (s *PostgresStore) CreateSyncRecord(userID, itemUUID string, record *models.SyncRecord) error {
	query := `
		INSERT INTO sync_records (id, user_id, item_uuid, zone, parent_key_uuid,
			wrapped_key, enc_item, enc_version, context_id, gencount, tombstone)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id, item_uuid, zone) DO UPDATE SET
			wrapped_key = EXCLUDED.wrapped_key,
			enc_item = EXCLUDED.enc_item,
			gencount = EXCLUDED.gencount,
			tombstone = EXCLUDED.tombstone
		RETURNING created_at, updated_at
	`

	recordID := uuid.New()
	itemID, _ := uuid.Parse(itemUUID)
	userIDParsed, _ := uuid.Parse(userID)

	err := s.db.QueryRow(query,
		recordID, userIDParsed, itemID, record.Zone, record.ParentKeyUUID,
		record.WrappedKey, record.EncItem, record.EncVersion, record.ContextID,
		record.GenCount, record.Tombstone,
	).Scan(&record.CreatedAt, &record.UpdatedAt)

	return err
}

func (s *PostgresStore) GetSyncRecordsByUser(userID, zone string, sinceGenCount int64) ([]*models.SyncRecord, error) {
	return s.GetSyncRecordsByUserWithFilter(userID, zone, sinceGenCount, true)
}

func (s *PostgresStore) GetSyncRecordsByUserWithFilter(userID, zone string, sinceGenCount int64, includeTombstoned bool) ([]*models.SyncRecord, error) {
	query := `
		SELECT id, user_id, item_uuid, zone, parent_key_uuid, wrapped_key,
		       enc_item, enc_version, context_id, gencount, tombstone,
		       created_at, updated_at
		FROM sync_records
		WHERE user_id = $1 AND zone = $2 AND gencount > $3 AND (tombstone = false OR $4 = true)
		ORDER BY gencount ASC
	`

	rows, err := s.db.Query(query, userID, zone, sinceGenCount, includeTombstoned)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*models.SyncRecord
	for rows.Next() {
		record := &models.SyncRecord{}
		err := rows.Scan(
			&record.ID, &record.UserID, &record.ItemUUID, &record.Zone,
			&record.ParentKeyUUID, &record.WrappedKey, &record.EncItem,
			&record.EncVersion, &record.ContextID, &record.GenCount,
			&record.Tombstone, &record.CreatedAt, &record.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}

func (s *PostgresStore) GetAllSyncRecordsByUser(userID, zone string) ([]*models.SyncRecord, error) {
	return s.GetSyncRecordsByUser(userID, zone, 0)
}

// Refresh token methods

type RefreshToken struct {
	Token     string
	UserID    string
	DeviceID  *string
	ExpiresAt time.Time
	CreatedAt time.Time
	Revoked   bool
}

func (s *PostgresStore) CreateRefreshToken(userID string, deviceID *string, expiresAt time.Time) (*RefreshToken, error) {
	token := &RefreshToken{
		Token:     uuid.New().String(),
		UserID:    userID,
		DeviceID:  deviceID,
		ExpiresAt: expiresAt,
		Revoked:   false,
	}

	query := `
		INSERT INTO refresh_tokens (token, user_id, device_id, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at
	`

	err := s.db.QueryRow(query, token.Token, token.UserID, token.DeviceID, token.ExpiresAt).
		Scan(&token.CreatedAt)

	if err != nil {
		return nil, err
	}

	return token, nil
}

func (s *PostgresStore) GetRefreshToken(token string) (*RefreshToken, error) {
	rt := &RefreshToken{}
	query := `
		SELECT token, user_id, device_id, expires_at, created_at, revoked
		FROM refresh_tokens WHERE token = $1
	`

	err := s.db.QueryRow(query, token).Scan(
		&rt.Token, &rt.UserID, &rt.DeviceID, &rt.ExpiresAt,
		&rt.CreatedAt, &rt.Revoked,
	)

	if err != nil {
		return nil, err
	}

	return rt, nil
}

func (s *PostgresStore) RevokeRefreshToken(token string) error {
	query := `UPDATE refresh_tokens SET revoked = true WHERE token = $1`
	_, err := s.db.Exec(query, token)
	return err
}
