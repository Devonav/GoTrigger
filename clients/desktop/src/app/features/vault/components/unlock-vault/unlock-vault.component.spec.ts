import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnlockVaultComponent } from './unlock-vault.component';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { CryptoService } from '../../../../core/crypto/crypto.service';
import { VaultStorageService } from '../../../../core/storage/vault-storage.service';
import { SyncService } from '../../../../core/sync/sync.service';

describe('UnlockVaultComponent', () => {
  let component: UnlockVaultComponent;
  let fixture: ComponentFixture<UnlockVaultComponent>;
  let mockBiometric: jasmine.SpyObj<BiometricService>;
  let mockCrypto: jasmine.SpyObj<CryptoService>;
  let mockStorage: jasmine.SpyObj<VaultStorageService>;
  let mockSync: jasmine.SpyObj<SyncService>;

  beforeEach(async () => {
    mockBiometric = jasmine.createSpyObj('BiometricService', [
      'isAvailable',
      'getMasterPassword',
      'saveMasterPassword',
      'deleteMasterPassword'
    ]);

    mockCrypto = jasmine.createSpyObj('CryptoService', [
      'deriveMasterKey',
      'clearMasterKey',
      'hasMasterKey'
    ]);

    mockStorage = jasmine.createSpyObj('VaultStorageService', [
      'initialize',
      'getConfig',
      'setConfig'
    ]);

    mockSync = jasmine.createSpyObj('SyncService', [
      'fullSync',
      'startAutoSync',
      'stopAutoSync'
    ]);

    mockBiometric.isAvailable.and.returnValue(Promise.resolve({ available: true, type: 'Touch ID / Face ID' }));
    mockBiometric.getMasterPassword.and.returnValue(Promise.resolve(null));
    mockStorage.initialize.and.returnValue(Promise.resolve('/path/to/vault.db'));
    mockStorage.getConfig.and.returnValue(Promise.resolve(null));
    mockCrypto.deriveMasterKey.and.returnValue(Promise.resolve({ masterKey: {} as CryptoKey, salt: new Uint8Array(32) }));
    mockSync.fullSync.and.returnValue(Promise.resolve({ pulled: 0, pushed: 0, conflicts: 0, errors: [] }));

    await TestBed.configureTestingModule({
      imports: [UnlockVaultComponent],
      providers: [
        { provide: BiometricService, useValue: mockBiometric },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: VaultStorageService, useValue: mockStorage },
        { provide: SyncService, useValue: mockSync }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UnlockVaultComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize and check biometric availability', async () => {
    await component.ngOnInit();

    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockBiometric.isAvailable).toHaveBeenCalled();
    expect(component.biometricAvailable()).toBe(true);
    expect(component.biometricType()).toBe('Touch ID / Face ID');
  });

  describe('Password unlock', () => {
    it('should show error if password is empty', async () => {
      component.masterPassword = '';
      await component.unlockWithPassword();

      expect(component.errorMessage()).toBe('Please enter your master password');
      expect(mockCrypto.deriveMasterKey).not.toHaveBeenCalled();
    });

    it('should unlock vault with valid password', async () => {
      component.masterPassword = 'test-password';
      mockStorage.getConfig.and.returnValue(Promise.resolve(btoa('test-salt')));

      await component.unlockWithPassword();

      expect(mockCrypto.deriveMasterKey).toHaveBeenCalled();
      expect(mockSync.fullSync).toHaveBeenCalled();
      expect(mockSync.startAutoSync).toHaveBeenCalled();
      expect(component.errorMessage()).toBe('');
      expect(component.masterPassword).toBe('');
    });

    xit('should save password to biometric if remember is enabled', async () => {
      component.masterPassword = 'test-password';
      // component.rememberPassword.set(true);
      component.biometricAvailable.set(true);

      await component.unlockWithPassword();

      expect(mockBiometric.saveMasterPassword).toHaveBeenCalledWith('test-password', 'default-user');
    });

    it('should handle unlock failure', async () => {
      component.masterPassword = 'wrong-password';
      mockCrypto.deriveMasterKey.and.returnValue(Promise.reject('Invalid password'));

      await component.unlockWithPassword();

      expect(component.errorMessage()).toBe('Invalid password or sync failed');
      expect(mockCrypto.clearMasterKey).toHaveBeenCalled();
      expect(component.isUnlocking()).toBe(false);
    });
  });

  describe('Biometric unlock', () => {
    it('should show error if biometric not available', async () => {
      component.biometricAvailable.set(false);

      await component.unlockWithBiometric();

      expect(component.errorMessage()).toBe('Biometric authentication not available');
      expect(mockBiometric.getMasterPassword).not.toHaveBeenCalled();
    });

    it('should show error if no saved password', async () => {
      component.biometricAvailable.set(true);
      mockBiometric.getMasterPassword.and.returnValue(Promise.resolve(null));

      await component.unlockWithBiometric();

      expect(component.errorMessage()).toContain('No saved password found');
    });

    it('should unlock with biometric successfully', async () => {
      component.biometricAvailable.set(true);
      mockBiometric.getMasterPassword.and.returnValue(Promise.resolve('saved-password'));
      mockStorage.getConfig.and.returnValue(Promise.resolve(btoa('test-salt')));

      await component.unlockWithBiometric();

      expect(mockCrypto.deriveMasterKey).toHaveBeenCalled();
      expect(mockSync.fullSync).toHaveBeenCalled();
      expect(mockSync.startAutoSync).toHaveBeenCalled();
    });

    it('should handle biometric unlock failure', async () => {
      component.biometricAvailable.set(true);
      mockBiometric.getMasterPassword.and.returnValue(Promise.reject('Biometric failed'));

      await component.unlockWithBiometric();

      expect(component.errorMessage()).toBe('Biometric authentication failed');
      expect(mockCrypto.clearMasterKey).toHaveBeenCalled();
    });
  });

  describe('UI interactions', () => {
    it('should toggle password visibility', () => {
      expect(component.showPassword()).toBe(false);
      
      component.togglePasswordVisibility();
      expect(component.showPassword()).toBe(true);
      
      component.togglePasswordVisibility();
      expect(component.showPassword()).toBe(false);
    });

    xit('should toggle remember password and delete if unchecked', async () => {
      // component.rememberPassword.set(true);

      // component.toggleRememberPassword();

      // expect(component.rememberPassword()).toBe(false);
      expect(mockBiometric.deleteMasterPassword).toHaveBeenCalledWith('default-user');
    });

    xit('should not delete saved password if checking remember', () => {
      // component.rememberPassword.set(false);

      // component.toggleRememberPassword();

      // expect(component.rememberPassword()).toBe(true);
      expect(mockBiometric.deleteMasterPassword).not.toHaveBeenCalled();
    });
  });

  describe('Salt management', () => {
    it('should save salt on first unlock', async () => {
      component.masterPassword = 'test-password';
      mockStorage.getConfig.and.returnValue(Promise.resolve(null));

      await component.unlockWithPassword();

      expect(mockStorage.setConfig).toHaveBeenCalledWith('master_salt', jasmine.any(String));
    });

    it('should use existing salt on subsequent unlocks', async () => {
      component.masterPassword = 'test-password';
      const saltB64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(32))));
      mockStorage.getConfig.and.returnValue(Promise.resolve(saltB64));

      await component.unlockWithPassword();

      expect(mockCrypto.deriveMasterKey).toHaveBeenCalledWith('test-password', jasmine.any(Uint8Array));
    });
  });
});
