import { contextBridge, ipcRenderer } from 'electron';

export interface BiometricAPI {
  isAvailable: () => Promise<{ available: boolean; type: string }>;
  saveMasterPassword: (password: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  getMasterPassword: (userId: string) => Promise<{ success: boolean; password?: string; error?: string }>;
  deleteMasterPassword: (userId: string) => Promise<{ success: boolean; error?: string }>;
  clearAll: () => Promise<{ success: boolean; error?: string }>;
}

export interface DatabaseAPI {
  initialize: () => Promise<{ success: boolean; path?: string; error?: string }>;
  
  // Legacy credential handlers (for backward compatibility)
  createCredential: (credential: any) => Promise<{ success: boolean; uuid?: string; error?: string }>;
  getCredential: (uuid: string) => Promise<{ success: boolean; credential?: any; error?: string }>;
  getAllCredentials: () => Promise<{ success: boolean; credentials?: any[]; error?: string }>;
  getCredentialsByServer: (server: string) => Promise<{ success: boolean; credentials?: any[]; error?: string }>;
  updateCredential: (uuid: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteCredential: (uuid: string) => Promise<{ success: boolean; error?: string }>;
  
  // Triple-layer handlers (new)
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

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  biometric: BiometricAPI;
  database: DatabaseAPI;
}

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  
  biometric: {
    isAvailable: (): Promise<{ available: boolean; type: string }> => 
      ipcRenderer.invoke('biometric:isAvailable'),
    
    saveMasterPassword: (password: string, userId: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('biometric:saveMasterPassword', password, userId),
    
    getMasterPassword: (userId: string): Promise<{ success: boolean; password?: string; error?: string }> => 
      ipcRenderer.invoke('biometric:getMasterPassword', userId),
    
    deleteMasterPassword: (userId: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('biometric:deleteMasterPassword', userId),
    
    clearAll: (): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('biometric:clearAll'),
  },

  database: {
    initialize: () => ipcRenderer.invoke('db:initialize'),
    
    // Legacy handlers
    createCredential: (credential: any) => ipcRenderer.invoke('db:createCredential', credential),
    getCredential: (uuid: string) => ipcRenderer.invoke('db:getCredential', uuid),
    getAllCredentials: () => ipcRenderer.invoke('db:getAllCredentials'),
    getCredentialsByServer: (server: string) => ipcRenderer.invoke('db:getCredentialsByServer', server),
    updateCredential: (uuid: string, updates: any) => ipcRenderer.invoke('db:updateCredential', uuid, updates),
    deleteCredential: (uuid: string) => ipcRenderer.invoke('db:deleteCredential', uuid),
    
    // Triple-layer handlers
    createCryptoKey: (key: any) => ipcRenderer.invoke('db:createCryptoKey', key),
    getCryptoKey: (uuid: string) => ipcRenderer.invoke('db:getCryptoKey', uuid),
    createCredentialMetadata: (metadata: any) => ipcRenderer.invoke('db:createCredentialMetadata', metadata),
    getCredentialMetadata: (uuid: string) => ipcRenderer.invoke('db:getCredentialMetadata', uuid),
    getAllCredentialMetadata: () => ipcRenderer.invoke('db:getAllCredentialMetadata'),
    createSyncRecord: (record: any) => ipcRenderer.invoke('db:createSyncRecord', record),
    getSyncRecordsByZone: (zone: string) => ipcRenderer.invoke('db:getSyncRecordsByZone', zone),
    updateSyncManifest: (manifest: any) => ipcRenderer.invoke('db:updateSyncManifest', manifest),
    getSyncManifest: (zone: string) => ipcRenderer.invoke('db:getSyncManifest', zone),
    
    setSyncState: (zone: string, gencount: number, digest: string) =>
      ipcRenderer.invoke('db:setSyncState', zone, gencount, digest),
    getSyncState: (zone: string) => ipcRenderer.invoke('db:getSyncState', zone),
    setConfig: (key: string, value: string) => ipcRenderer.invoke('db:setConfig', key, value),
    getConfig: (key: string) => ipcRenderer.invoke('db:getConfig', key),
    close: () => ipcRenderer.invoke('db:close'),
    clearDatabase: () => ipcRenderer.invoke('db:clearDatabase'),
  }
});
