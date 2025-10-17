export enum VaultState {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
  BIOMETRIC_READY = 'BIOMETRIC_READY'
}

export enum UnlockMethod {
  MASTER_PASSWORD = 'MASTER_PASSWORD',
  BIOMETRIC = 'BIOMETRIC',
  PIN = 'PIN'
}

export interface VaultConfig {
  autoLockTimeout: number; // milliseconds
  biometricEnabled: boolean;
  pinEnabled: boolean;
  requirePasswordEvery: number; // days
}

export interface UnlockResult {
  success: boolean;
  masterKey?: Uint8Array;
  error?: string;
}
