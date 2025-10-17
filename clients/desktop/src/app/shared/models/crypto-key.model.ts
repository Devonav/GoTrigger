/**
 * Layer 1: Cryptographic Keys
 * Mirrors Apple's keys table in keychain-2.db
 */

export enum KeyClass {
  Symmetric = 0,
  Public = 1,
  Private = 2
}

export enum KeyType {
  AES256GCM = 0,
  Ed25519 = 1,
  X25519 = 2
}

export interface KeyUsageFlags {
  encrypt: boolean;
  decrypt: boolean;
  wrap: boolean;
  unwrap: boolean;
  sign: boolean;
  verify: boolean;
  derive: boolean;
}

export interface CryptoKey {
  uuid: string;
  keyClass: KeyClass;
  keyType: KeyType;
  label?: string;
  applicationLabel?: string;
  
  // Encrypted key data
  data: Uint8Array;
  
  // Access control
  accessGroup: string;
  
  // Usage flags
  usageFlags: KeyUsageFlags;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  
  // Sync
  tombstone: boolean;
}
