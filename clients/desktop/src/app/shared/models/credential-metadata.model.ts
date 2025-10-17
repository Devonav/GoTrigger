/**
 * Layer 2: Credential Metadata
 * Mirrors Apple's inet table in keychain-2.db
 * Stores credential information but references CryptoKey for actual password
 */

export interface CredentialMetadata {
  uuid: string;
  
  // Server information
  server: string;
  account: string;
  protocol: number;
  port: number;
  path?: string;
  
  // Reference to encrypted password key
  passwordKeyUUID: string;
  
  // Optional: encrypted metadata (notes, etc.)
  metadataKeyUUID?: string;
  
  // Display
  label?: string;
  
  // Access control
  accessGroup: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  
  // Sync
  tombstone: boolean;
}

/**
 * Decrypted credential data (never stored, only in memory)
 */
export interface DecryptedCredentialData {
  password: string;
  notes?: string;
  customFields?: { [key: string]: string };
}

/**
 * Full credential with decrypted data (for display)
 */
export interface VaultCredential {
  metadata: CredentialMetadata;
  data: DecryptedCredentialData;
}
