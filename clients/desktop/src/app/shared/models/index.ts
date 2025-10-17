/**
 * Triple-Layer Data Model (Apple Keychain Pattern)
 * 
 * Layer 1: CryptoKey - Raw cryptographic keys
 * Layer 2: CredentialMetadata - Credential information (references keys)
 * Layer 3: SyncRecord - Sync orchestration layer
 */

export * from './crypto-key.model';
export * from './credential-metadata.model';
export * from './sync-record.model';

// Keep old model for backward compatibility during migration
export type { StoredCredential, DecryptedCredential, LegacyVaultCredential } from './credential.model';
