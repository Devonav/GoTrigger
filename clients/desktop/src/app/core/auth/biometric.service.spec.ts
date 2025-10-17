import { TestBed } from '@angular/core/testing';
import { BiometricService } from './biometric.service';

describe('BiometricService', () => {
  let service: BiometricService;
  let mockElectron: any;

  beforeEach(() => {
    mockElectron = {
      biometric: {
        isAvailable: jasmine.createSpy('isAvailable').and.returnValue(
          Promise.resolve({ available: true, type: 'Touch ID / Face ID' })
        ),
        saveMasterPassword: jasmine.createSpy('saveMasterPassword').and.returnValue(
          Promise.resolve({ success: true })
        ),
        getMasterPassword: jasmine.createSpy('getMasterPassword').and.returnValue(
          Promise.resolve({ success: true, password: 'test-password' })
        ),
        deleteMasterPassword: jasmine.createSpy('deleteMasterPassword').and.returnValue(
          Promise.resolve({ success: true })
        ),
        clearAll: jasmine.createSpy('clearAll').and.returnValue(
          Promise.resolve({ success: true })
        ),
      }
    };

    (window as any).electron = mockElectron;

    TestBed.configureTestingModule({});
    service = TestBed.inject(BiometricService);
  });

  afterEach(() => {
    delete (window as any).electron;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should check biometric availability', async () => {
    const result = await service.isAvailable();
    expect(result.available).toBe(true);
    expect(result.type).toBe('Touch ID / Face ID');
    expect(mockElectron.biometric.isAvailable).toHaveBeenCalled();
  });

  it('should save master password to keychain', async () => {
    const success = await service.saveMasterPassword('my-password', 'user-123');
    expect(success).toBe(true);
    expect(mockElectron.biometric.saveMasterPassword).toHaveBeenCalledWith('my-password', 'user-123');
  });

  it('should retrieve master password from keychain', async () => {
    const password = await service.getMasterPassword('user-123');
    expect(password).toBe('test-password');
    expect(mockElectron.biometric.getMasterPassword).toHaveBeenCalledWith('user-123');
  });

  it('should delete master password from keychain', async () => {
    const success = await service.deleteMasterPassword('user-123');
    expect(success).toBe(true);
    expect(mockElectron.biometric.deleteMasterPassword).toHaveBeenCalledWith('user-123');
  });

  it('should clear all stored passwords', async () => {
    const success = await service.clearAllStoredPasswords();
    expect(success).toBe(true);
    expect(mockElectron.biometric.clearAll).toHaveBeenCalled();
  });

  it('should get platform-specific biometric name', () => {
    const name = service.getBiometricName();
    expect(name).toBeTruthy();
    expect(typeof name).toBe('string');
  });
});
