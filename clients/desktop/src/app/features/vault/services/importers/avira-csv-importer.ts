import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Avira CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/avira-csv-importer.ts
 *
 * CSV Format: name,website,username,secondary_username,password
 */
export class AviraCsvImporter extends BaseImporter {
  readonly formatId = 'avira-csv';
  readonly formatName = 'Avira (CSV)';
  readonly formatDescription = 'CSV export from Avira password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        let username = '';
        let notes = '';

        // Use secondary_username as username if username is empty, otherwise put it in notes
        if (this.isNullOrWhitespace(row.username) && !this.isNullOrWhitespace(row.secondary_username)) {
          username = row.secondary_username;
        } else {
          username = row.username || '';
          if (!this.isNullOrWhitespace(row.secondary_username)) {
            notes = row.secondary_username;
          }
        }

        const credential: ParsedCredential = {
          url: row.website || '',
          username,
          password: row.password || '',
          notes: notes || undefined,
          name: row.name || this.extractDomain(row.website) || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Avira CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
