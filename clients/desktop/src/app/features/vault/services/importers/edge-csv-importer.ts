import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Microsoft Edge CSV Importer
 * Based on Chromium, so format is similar to Chrome
 *
 * Format: name,url,username,password
 * Example: Facebook,https://facebook.com,user@example.com,password123
 */
export class EdgeCsvImporter extends BaseImporter {
  readonly formatId = 'edge-csv';
  readonly formatName = 'Microsoft Edge (CSV)';
  readonly formatDescription = 'CSV export from Microsoft Edge password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        const credential: ParsedCredential = {
          url: row.url || '',
          username: row.username || '',
          password: row.password || '',
          name: row.name || undefined,
          notes: row.note || row.notes || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Edge CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
