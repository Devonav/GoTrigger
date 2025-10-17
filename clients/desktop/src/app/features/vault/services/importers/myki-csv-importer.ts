import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Myki CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/myki-csv-importer.ts
 * CSV Format: nickname,url,username,password,additionalInfo,twoFASecret (for user accounts)
 */
export class MykiCsvImporter extends BaseImporter {
  readonly formatId = 'myki-csv';
  readonly formatName = 'Myki (CSV)';
  readonly formatDescription = 'CSV export from Myki password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Check what type of entry this is based on columns present
        const isUserAccount = row.url || row.username || row.password;

        if (!isUserAccount) {
          continue; // Skip cards, notes, etc.
        }

        const totp = row.twoFASecret || row.twofaSecret || ''; // Column name might vary

        const credential: ParsedCredential = {
          url: row.url || '',
          username: row.username || '',
          password: row.password || '',
          notes: row.additionalInfo || undefined,
          name: row.nickname || undefined,
          totp: totp || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Myki CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
