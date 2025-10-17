package errors

import "errors"

var (
	ErrSyncConflict    = errors.New("sync conflict detected")
	ErrManifestInvalid = errors.New("invalid manifest")
	ErrDigestMismatch  = errors.New("digest mismatch")
	ErrGenCountStale   = errors.New("gencount is stale")
)
