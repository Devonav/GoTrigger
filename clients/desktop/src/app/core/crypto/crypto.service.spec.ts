import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  afterEach(() => {
    service.clearMasterKey();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Master Key Derivation', () => {
    it('should derive master key from password', async () => {
      const password = 'test-password-123';
      const result = await service.deriveMasterKey(password);

      expect(result.masterKey).toBeTruthy();
      expect(result.salt).toBeTruthy();
      expect(result.salt.byteLength).toBe(32);
      expect(service.hasMasterKey()).toBe(true);
    });

    it('should derive same key with same password and salt', async () => {
      const password = 'test-password-123';
      const result1 = await service.deriveMasterKey(password);
      
      service.clearMasterKey();
      
      const result2 = await service.deriveMasterKey(password, result1.salt);

      const key1Exported = await crypto.subtle.exportKey('raw', result1.masterKey);
      const key2Exported = await crypto.subtle.exportKey('raw', result2.masterKey);

      expect(new Uint8Array(key1Exported)).toEqual(new Uint8Array(key2Exported));
    });

    it('should derive different keys with different passwords', async () => {
      const result1 = await service.deriveMasterKey('password1');
      service.clearMasterKey();
      
      const result2 = await service.deriveMasterKey('password2', result1.salt);

      const key1Exported = await crypto.subtle.exportKey('raw', result1.masterKey);
      const key2Exported = await crypto.subtle.exportKey('raw', result2.masterKey);

      expect(new Uint8Array(key1Exported)).not.toEqual(new Uint8Array(key2Exported));
    });
  });

  describe('Credential Encryption/Decryption', () => {
    beforeEach(async () => {
      await service.deriveMasterKey('test-password-123');
    });

    it('should encrypt and decrypt credential data', async () => {
      const originalData = {
        username: 'test@example.com',
        password: 'secret-password',
        url: 'https://example.com'
      };

      const encrypted = await service.encryptCredential(originalData);
      
      expect(encrypted.wrappedKey).toBeTruthy();
      expect(encrypted.encItem).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();

      const decrypted = await service.decryptCredential(encrypted);
      
      expect(decrypted).toEqual(originalData);
    });

    it('should throw error when encrypting without master key', async () => {
      service.clearMasterKey();
      
      const data = { test: 'data' };
      
      await expectAsync(service.encryptCredential(data))
        .toBeRejectedWithError('Master key not derived. Call deriveMasterKey first.');
    });

    it('should throw error when decrypting without master key', async () => {
      const data = { test: 'data' };
      const encrypted = await service.encryptCredential(data);
      
      service.clearMasterKey();
      
      await expectAsync(service.decryptCredential(encrypted))
        .toBeRejectedWithError('Master key not derived. Call deriveMasterKey first.');
    });

    it('should fail to decrypt with wrong master key', async () => {
      const data = { test: 'data' };
      const encrypted = await service.encryptCredential(data);
      
      service.clearMasterKey();
      await service.deriveMasterKey('wrong-password');
      
      await expectAsync(service.decryptCredential(encrypted))
        .toBeRejected();
    });

    it('should encrypt same data differently each time', async () => {
      const data = { test: 'data' };
      
      const encrypted1 = await service.encryptCredential(data);
      const encrypted2 = await service.encryptCredential(data);

      expect(encrypted1.encItem).not.toEqual(encrypted2.encItem);
      expect(encrypted1.wrappedKey).not.toEqual(encrypted2.wrappedKey);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });
  });

  describe('Utility Functions', () => {
    it('should hash password consistently', async () => {
      const password = 'test-password';
      
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate unique device IDs', async () => {
      const id1 = await service.generateDeviceId();
      const id2 = await service.generateDeviceId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should clear master key', async () => {
      await service.deriveMasterKey('test-password');
      expect(service.hasMasterKey()).toBe(true);

      service.clearMasterKey();
      expect(service.hasMasterKey()).toBe(false);
    });
  });
});
