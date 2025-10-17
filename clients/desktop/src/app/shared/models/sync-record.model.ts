/**
 * Layer 3: Sync Records
 * Mirrors Apple's ckmirror table in keychain-2.db
 * Contains encrypted blobs for syncing between devices
 */

export interface SyncRecord {
  // Sync zone
  zone: string;
  
  // Item identifier (matches CryptoKey.uuid or CredentialMetadata.uuid)
  uuid: string;
  
  // Parent key UUID (for key hierarchy)
  parentKeyUUID: string;
  
  // Generation counter (Lamport timestamp)
  gencount: number;
  
  // Encrypted data
  wrappedKey: Uint8Array;
  encItem: Uint8Array;
  
  // Encryption version
  encVersion: number;
  
  // Context for multi-context support
  contextID: string;
  
  // Deletion marker
  tombstone: boolean;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * Sync manifest (Merkle tree digest)
 * Mirrors Apple's ckmanifest table
 */
export interface SyncManifest {
  zone: string;
  gencount: number;
  digest: Uint8Array | null;
  leafIDs: string[];
  signerID?: string;
  signatures?: Uint8Array;
  updatedAt: number;
}

/**
 * Sync state (local tracking)
 */
export interface SyncState {
  zone: string;
  lastGencount: number;
  lastDigest: Uint8Array | null;
  lastSync: number;
}
