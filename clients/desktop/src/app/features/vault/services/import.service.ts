import { Injectable } from '@angular/core';
import { VaultService } from './vault.service';
import {
  BaseImporter,
  ParsedCredential,
  // CSV Importers - Major Password Managers
  LastPassCsvImporter,
  OnePasswordCsvImporter,
  DashlaneCsvImporter,
  NordPassCsvImporter,
  KeeperCsvImporter,
  BitwardenCsvImporter,
  RoboFormCsvImporter,
  ZohoVaultCsvImporter,
  MSecureCsvImporter,
  AvastCsvImporter,
  // CSV Importers - Browsers
  ChromeCsvImporter,
  EdgeCsvImporter,
  FirefoxCsvImporter,
  SafariCsvImporter,
  BraveCsvImporter,
  OperaCsvImporter,
  VivaldiCsvImporter,
  // CSV Importers - Other
  AscendoCsvImporter,
  AviraCsvImporter,
  BlackBerryCsvImporter,
  BlurCsvImporter,
  ButtercupCsvImporter,
  CodebookCsvImporter,
  EncryptrCsvImporter,
  KasperskyTxtImporter,
  KeePassXCsvImporter,
  MykiCsvImporter,
  PasspackCsvImporter,
  RememBearCsvImporter,
  SaferPassCsvImporter,
  TrueKeyCsvImporter,
  // JSON Importers
  AvastJsonImporter,
  BitwardenJsonImporter,
  DashlaneJsonImporter,
  EnpassJsonImporter,
  KeeperJsonImporter,
  OnePassword1PifImporter,
  OnePassword1PuxImporter,
  PassmanJsonImporter,
  PasswordBossJsonImporter,
  ProtonPassJsonImporter,
  // XML Importers
  KeePass2XmlImporter,
  PasswordDepotXmlImporter,
  PasswordDragonXmlImporter,
  PasswordSafeXmlImporter,
  SafeInCloudXmlImporter,
  StickyPasswordXmlImporter
} from './importers';

// Ensure that the necessary modules are installed and configured correctly

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  skipped: number;
}

export interface ImportFormat {
  id: string;
  name: string;
  description: string;
}

/**
 * Import Service - Handles CSV/JSON import from various password managers
 * Architecture: Client-side only (like Bitwarden)
 * - Parse CSV/JSON locally using importer classes
 * - Encrypt with vault key
 * - Store encrypted blobs
 * - Server never sees plaintext
 *
 * Follows Bitwarden's importer pattern with BaseImporter + specific importers
 */
@Injectable({
  providedIn: 'root'
})
export class ImportService {

  // All supported importers (organized by category and popularity)
  private readonly importers: BaseImporter[] = [
    // === MAJOR PASSWORD MANAGERS (CSV) ===
    new LastPassCsvImporter(),      // ~21% market share
    new OnePasswordCsvImporter(),   // ~25% market share
    new DashlaneCsvImporter(),      // ~15% market share
    new BitwardenCsvImporter(),     // ~20% open-source
    new NordPassCsvImporter(),      // Growing rapidly
    new KeeperCsvImporter(),        // ~5% enterprise focused

    // === BROWSER PASSWORD MANAGERS (CSV) ===
    new ChromeCsvImporter(),        // Chrome/Chromium
    new EdgeCsvImporter(),          // Microsoft Edge
    new FirefoxCsvImporter(),       // Mozilla Firefox
    new SafariCsvImporter(),        // Apple Safari
    new BraveCsvImporter(),         // Brave Browser
    new OperaCsvImporter(),         // Opera Browser
    new VivaldiCsvImporter(),       // Vivaldi Browser

    // === OTHER PASSWORD MANAGERS (CSV) ===
    new RoboFormCsvImporter(),      // ~5% market share
    new ZohoVaultCsvImporter(),     // Enterprise users
    new MSecureCsvImporter(),       // Popular mobile app
    new AvastCsvImporter(),         // Antivirus suite
    new AscendoCsvImporter(),       // Ascendo DataVault
    new AviraCsvImporter(),         // Avira Password Manager
    new BlackBerryCsvImporter(),    // BlackBerry Password Keeper
    new BlurCsvImporter(),          // Blur (by Abine)
    new ButtercupCsvImporter(),     // Buttercup
    new CodebookCsvImporter(),      // Codebook
    new EncryptrCsvImporter(),      // Encryptr
    new KasperskyTxtImporter(),     // Kaspersky Password Manager
    new KeePassXCsvImporter(),      // KeePassX
    new MykiCsvImporter(),          // Myki
    new PasspackCsvImporter(),      // Passpack
    new RememBearCsvImporter(),     // RememBear
    new SaferPassCsvImporter(),     // SaferPass
    new TrueKeyCsvImporter(),       // True Key

    // === JSON IMPORTERS ===
    new AvastJsonImporter(),        // Avast Passwords (JSON)
    new BitwardenJsonImporter(),    // Bitwarden (JSON full export)
    new DashlaneJsonImporter(),     // Dashlane (JSON)
    new EnpassJsonImporter(),       // Enpass (JSON)
    new KeeperJsonImporter(),       // Keeper Security (JSON)
    new OnePassword1PifImporter(),  // 1Password (1PIF legacy)
    new OnePassword1PuxImporter(),  // 1Password (1PUX v8+)
    new PassmanJsonImporter(),      // Passman (JSON)
    new PasswordBossJsonImporter(), // Password Boss (JSON)
    new ProtonPassJsonImporter(),   // Proton Pass (JSON)

    // === XML IMPORTERS ===
    new KeePass2XmlImporter(),      // KeePass2 (very popular open-source)
    new PasswordDepotXmlImporter(), // Password Depot
    new PasswordDragonXmlImporter(),// Password Dragon (discontinued)
    new PasswordSafeXmlImporter(),  // Password Safe (pwsafe.org)
    new SafeInCloudXmlImporter(),   // SafeInCloud
    new StickyPasswordXmlImporter(),// Sticky Password
  ];

  constructor(private vaultService: VaultService) {}

  /**
   * Get list of supported import formats
   */
  getSupportedFormats(): ImportFormat[] {
    const formats: ImportFormat[] = this.importers.map(importer => ({
      id: importer.formatId,
      name: importer.formatName,
      description: importer.formatDescription
    }));

    // Add legacy formats (still using old parsing logic)
    formats.push(
      {
        id: 'generic-csv',
        name: 'Generic (CSV)',
        description: 'Basic CSV with url, username, password'
      }
    );

    return formats;
  }

  /**
   * Import credentials from CSV file
   * Follows Bitwarden's approach: parse locally, encrypt, store
   */
  async importFromFile(file: File, formatId: string = 'generic-csv'): Promise<ImportResult> {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file size (prevent DoS)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File too large (max 10MB)');
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json') && !file.name.endsWith('.xml')) {
      throw new Error('Only CSV, JSON, and XML files are supported');
    }

    // Read file content
    const content = await file.text();

    // Parse using appropriate importer
    return this.importWithImporter(content, formatId);
  }

  /**
   * Import content using appropriate importer (CSV or JSON)
   */
  private async importWithImporter(content: string, formatId: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      skipped: 0
    };

    try {
      // Find appropriate importer
      const importer = this.getImporter(formatId);

      let credentials: ParsedCredential[];

      if (importer) {
        // Use BaseImporter subclass
        credentials = await importer.parse(content);
      } else {
        // Fallback to legacy parsing (for generic, bitwarden, chrome)
        credentials = await this.legacyParse(content, formatId);
      }

      if (!credentials || credentials.length === 0) {
        result.success = false;
        result.errors.push('No credentials found in CSV file');
        return result;
      }

      // Process each credential
      for (let i = 0; i < credentials.length; i++) {
        const cred = credentials[i];
        const rowNum = i + 2; // +2 because header is row 1

        try {
          // Validate required fields
          if (!cred.url || !cred.username || !cred.password) {
            result.skipped++;
            result.errors.push(`Row ${rowNum}: Missing required fields (url, username, or password)`);
            continue;
          }

          // Add credential using VaultService (handles encryption + sync)
          await this.vaultService.addCredential(
            cred.url,
            cred.username,
            cred.password,
            cred.notes
          );

          result.imported++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Row ${rowNum}: ${error.message || 'Unknown error'}`);
        }
      }

      result.success = result.imported > 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message || 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get importer instance for format ID
   */
  private getImporter(formatId: string): BaseImporter | null {
    return this.importers.find(imp => imp.formatId === formatId) || null;
  }

  /**
   * Legacy parse method for formats not yet migrated to BaseImporter
   * (generic-csv, bitwarden-csv, chrome-csv)
   */
  private async legacyParse(content: string, formatId: string): Promise<ParsedCredential[]> {
    const Papa = await import('papaparse');
    const parseResult = Papa.default.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase()
    });

    const rows = parseResult.data || [];
    const credentials: ParsedCredential[] = [];

    for (const row of rows as any[]) {
      let url = '';
      let username = '';
      let password = '';
      let notes = '';

      switch (formatId) {
        case 'generic-csv':
        default:
          url = row.url || row.website || row.login_uri || row.site || '';
          username = row.username || row.login_username || row.user || row.account || '';
          password = row.password || row.login_password || row.pass || '';
          notes = row.notes || row.note || row.comment || '';
          break;
      }

      if (url && username && password) {
        credentials.push({
          url: url.trim(),
          username: username.trim(),
          password: password.trim(),
          notes: notes?.trim() || undefined
        });
      }
    }

    return credentials;
  }

  /**
   * Export current vault to CSV (for backup/migration)
   * Future enhancement
   */
  async exportToCsv(): Promise<string> {
    // TODO: Implement export functionality
    throw new Error('Export not yet implemented');
  }
}
