interface DatabaseAPI {
  initialize: () => Promise<{ success: boolean; path?: string; error?: string }>;
  
  // Legacy handlers
  createCredential: (credential: any) => Promise<{ success: boolean; uuid?: string; error?: string }>;
  getCredential: (uuid: string) => Promise<{ success: boolean; credential?: any; error?: string }>;
  getAllCredentials: () => Promise<{ success: boolean; credentials?: any[]; error?: string }>;
  getCredentialsByServer: (server: string) => Promise<{ success: boolean; credentials?: any[]; error?: string }>;
  updateCredential: (uuid: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteCredential: (uuid: string) => Promise<{ success: boolean; error?: string }>;
  
  // Triple-layer handlers
  createCryptoKey: (key: any) => Promise<{ success: boolean; uuid?: string; error?: string }>;
  getCryptoKey: (uuid: string) => Promise<{ success: boolean; key?: any; error?: string }>;
  createCredentialMetadata: (metadata: any) => Promise<{ success: boolean; uuid?: string; error?: string }>;
  getCredentialMetadata: (uuid: string) => Promise<{ success: boolean; metadata?: any; error?: string }>;
  getAllCredentialMetadata: () => Promise<{ success: boolean; credentials?: any[]; error?: string }>;
  createSyncRecord: (record: any) => Promise<{ success: boolean; error?: string }>;
  getSyncRecordsByZone: (zone: string) => Promise<{ success: boolean; records?: any[]; error?: string }>;
  updateSyncManifest: (manifest: any) => Promise<{ success: boolean; error?: string }>;
  getSyncManifest: (zone: string) => Promise<{ success: boolean; manifest?: any; error?: string }>;
  
  setSyncState: (zone: string, gencount: number, digest: string) => Promise<{ success: boolean; error?: string }>;
  getSyncState: (zone: string) => Promise<{ success: boolean; state?: any; error?: string }>;
  setConfig: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
  getConfig: (key: string) => Promise<{ success: boolean; value?: string | null; error?: string }>;
  close: () => Promise<{ success: boolean; error?: string }>;
  clearDatabase: () => Promise<{ success: boolean; error?: string }>;
}

interface BiometricAPI {
  isAvailable: () => Promise<{ available: boolean; type: string }>;
  saveMasterPassword: (password: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  getMasterPassword: (userId: string) => Promise<{ success: boolean; password?: string; error?: string }>;
  deleteMasterPassword: (userId: string) => Promise<{ success: boolean; error?: string }>;
  clearAll: () => Promise<{ success: boolean; error?: string }>;
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  biometric: BiometricAPI;
  database: DatabaseAPI;
}

interface Window {
  electron: ElectronAPI;
}
