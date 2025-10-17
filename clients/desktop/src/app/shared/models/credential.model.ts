export interface StoredCredential {
  uuid: string;
  server: string;
  account: string;
  wrappedKey: string;
  encItem: string;
  iv: string;
  salt: string;
  gencount: number;
  created_at?: number;
  updated_at?: number;
  deleted?: number;
}

export interface DecryptedCredential {
  username: string;
  password: string;
  url?: string;
  notes?: string;
  [key: string]: any;
}

// Legacy model - deprecated, use VaultCredential from credential-metadata.model.ts
export interface LegacyVaultCredential {
  uuid: string;
  server: string;
  account: string;
  data: DecryptedCredential;
  gencount: number;
  created_at?: number;
  updated_at?: number;
}

// Export alias for backward compatibility
export type VaultCredential = LegacyVaultCredential;
