import { TestBed } from '@angular/core/testing';
import { ImportService } from './import.service';
import { VaultService } from './vault.service';
import { LastPassCsvImporter } from './importers/lastpass-csv-importer';
import { FirefoxCsvImporter } from './importers/firefox-csv-importer';
import { SafariCsvImporter } from './importers/safari-csv-importer';

describe('ImportService - Sample Files Integration Tests', () => {
  let service: ImportService;
  let mockVaultService: jasmine.SpyObj<VaultService>;

  // Sample CSV content (from test/sample-imports/)
  const LASTPASS_SAMPLE = `url,username,password,totp,extra,name,grouping,fav
https://www.facebook.com/login.php,john@example.com,FBPass123!,,My personal Facebook account,Facebook,Social,1
https://github.com/login,john@example.com,GitHubSecure789$,JBSWY3DPEHPK3PXP,Developer account with 2FA,GitHub,Development,1`;

  const FIREFOX_SAMPLE = `url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
https://www.reddit.com,redditor_john,RedditPass123!,,,{abc123-def456-ghi789},1633024800000,1696118400000,1696118400000
https://discord.com,john#1234,DiscordSecure456#,,,{def456-ghi789-jkl012},1633024900000,1696118500000,1696118500000`;

  const SAFARI_SAMPLE = `Title,Url,Username,Password,OTPAuth
Netflix,https://www.netflix.com,john@example.com,NetflixPass123!,
Dropbox,https://www.dropbox.com,john@example.com,DropboxCloud2024%,otpauth://totp/Dropbox:john@example.com?secret=JBSWY3DPEHPK3PXP`;

  beforeEach(() => {
    mockVaultService = jasmine.createSpyObj('VaultService', ['addCredential']);
    mockVaultService.addCredential.and.returnValue(Promise.resolve({} as any));

    TestBed.configureTestingModule({
      providers: [
        ImportService,
        { provide: VaultService, useValue: mockVaultService }
      ]
    });

    service = TestBed.inject(ImportService);
  });

  describe('LastPass Importer', () => {
    it('should parse LastPass CSV correctly', async () => {
      const importer = new LastPassCsvImporter();
      const credentials = await importer.parse(LASTPASS_SAMPLE);

      expect(credentials.length).toBe(2);

      // Check first credential
      expect(credentials[0].url).toBe('https://www.facebook.com/login.php');
      expect(credentials[0].username).toBe('john@example.com');
      expect(credentials[0].password).toBe('FBPass123!');
      expect(credentials[0].folder).toBe('Social');
      expect(credentials[0].notes).toContain('Folder: Social');
      expect(credentials[0].notes).toContain('Favorite: Yes');

      // Check second credential with TOTP
      expect(credentials[1].url).toBe('https://github.com/login');
      expect(credentials[1].totp).toBe('JBSWY3DPEHPK3PXP');
      expect(credentials[1].notes).toContain('TOTP: JBSWY3DPEHPK3PXP');
      expect(credentials[1].folder).toBe('Development');
    });

    it('should decode HTML entities', async () => {
      const htmlSample = `url,username,password,totp,extra,name,grouping,fav
https://test.com,user,pass,,Q&amp;A account,Test,Work,0`;

      const importer = new LastPassCsvImporter();
      const credentials = await importer.parse(htmlSample);

      expect(credentials[0].notes).toContain('Q&A account');
    });
  });

  describe('Firefox Importer', () => {
    it('should parse Firefox CSV correctly', async () => {
      const importer = new FirefoxCsvImporter();
      const credentials = await importer.parse(FIREFOX_SAMPLE);

      expect(credentials.length).toBe(2);

      expect(credentials[0].url).toBe('https://www.reddit.com');
      expect(credentials[0].username).toBe('redditor_john');
      expect(credentials[0].password).toBe('RedditPass123!');

      expect(credentials[1].url).toBe('https://discord.com');
      expect(credentials[1].username).toBe('john#1234');
    });

    it('should ignore Firefox metadata columns', async () => {
      const importer = new FirefoxCsvImporter();
      const credentials = await importer.parse(FIREFOX_SAMPLE);

      // Should not crash on metadata, just ignore it
      expect(credentials.length).toBeGreaterThan(0);
    });
  });

  describe('Safari Importer', () => {
    it('should parse Safari CSV correctly with capitalized headers', async () => {
      const importer = new SafariCsvImporter();
      const credentials = await importer.parse(SAFARI_SAMPLE);

      expect(credentials.length).toBe(2);

      expect(credentials[0].url).toBe('https://www.netflix.com');
      expect(credentials[0].username).toBe('john@example.com');
      expect(credentials[0].password).toBe('NetflixPass123!');
      expect(credentials[0].name).toBe('Netflix');

      // Check OTP handling
      expect(credentials[1].notes).toContain('OTP:');
    });

    it('should handle lowercase headers as fallback', async () => {
      const lowercaseSample = `title,url,username,password,otpauth
Test,https://test.com,user,pass,`;

      const importer = new SafariCsvImporter();
      const credentials = await importer.parse(lowercaseSample);

      expect(credentials.length).toBe(1);
      expect(credentials[0].url).toBe('https://test.com');
    });
  });

  describe('CSV Injection Prevention', () => {
    it('should sanitize dangerous CSV values', async () => {
      const dangerousSample = `url,username,password,totp,extra,name,grouping,fav
https://test.com,=cmd|calc,+formula,,,Test,Work,0`;

      const importer = new LastPassCsvImporter();
      const credentials = await importer.parse(dangerousSample);

      // Should remove leading formula characters
      expect(credentials[0].username).not.toMatch(/^[=@+\-]/);
      expect(credentials[0].password).not.toMatch(/^[=@+\-]/);
    });
  });

  describe('Integration - Full Import Flow', () => {
    it('should import LastPass sample file successfully', async () => {
      const file = new File([LASTPASS_SAMPLE], 'lastpass.csv', { type: 'text/csv' });
      const result = await service.importFromFile(file, 'lastpass-csv');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockVaultService.addCredential).toHaveBeenCalledTimes(2);
    });

    it('should import Firefox sample file successfully', async () => {
      const file = new File([FIREFOX_SAMPLE], 'firefox.csv', { type: 'text/csv' });
      const result = await service.importFromFile(file, 'firefox-csv');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(mockVaultService.addCredential).toHaveBeenCalledTimes(2);
    });

    it('should import Safari sample file successfully', async () => {
      const file = new File([SAFARI_SAMPLE], 'safari.csv', { type: 'text/csv' });
      const result = await service.importFromFile(file, 'safari-csv');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(mockVaultService.addCredential).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const invalidSample = `url,username,password,totp,extra,name,grouping,fav
https://test.com,,,,,Test,Work,0`;

      const file = new File([invalidSample], 'invalid.csv', { type: 'text/csv' });
      const result = await service.importFromFile(file, 'lastpass-csv');

      expect(result.skipped).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject files over 10MB', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

      await expectAsync(service.importFromFile(file, 'lastpass-csv'))
        .toBeRejectedWithError(/too large/);
    });
  });
});
