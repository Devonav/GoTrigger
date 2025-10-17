import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * SaferPass CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/saferpass-csv-importer.ts
 * CSV Format: url,username,password,notes
 */
export class SaferPassCsvImporter extends BaseImporter {
  readonly formatId = 'saferpass-csv';
  readonly formatName = 'SaferPass (CSV)';
  readonly formatDescription = 'CSV export from SaferPass password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        const url = row.url || '';

        const credential: ParsedCredential = {
          url,
          username: row.username || '',
          password: row.password || '',
          notes: row.notes || undefined,
          name: url ? this.extractDomain(url) : undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing SaferPass CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
