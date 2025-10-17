import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Avast Passwords CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/avast/avast-csv-importer.ts
 *
 * CSV Format: name,web,login,password
 * Example: GitHub,https://github.com,user@example.com,password123
 *
 * Very simple format!
 */
export class AvastCsvImporter extends BaseImporter {
  readonly formatId = 'avast-csv';
  readonly formatName = 'Avast Passwords (CSV)';
  readonly formatDescription = 'CSV export from Avast Passwords';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        const credential: ParsedCredential = {
          url: row.web || '',
          username: row.login || '',
          password: row.password || '',
          name: row.name || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Avast CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
