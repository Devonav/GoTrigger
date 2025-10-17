import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Blur CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/blur-csv-importer.ts
 *
 * CSV Format: label,domain,email,username,password
 */
export class BlurCsvImporter extends BaseImporter {
  readonly formatId = 'blur-csv';
  readonly formatName = 'Blur (CSV)';
  readonly formatDescription = 'CSV export from Blur password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        // Skip rows with label "null"
        if (row.label === 'null') {
          continue;
        }

        let username = '';
        let notes = '';

        // Use email as username if username is empty, otherwise put username in notes
        if (this.isNullOrWhitespace(row.email) && !this.isNullOrWhitespace(row.username)) {
          username = row.username;
        } else {
          username = row.email || '';
          if (!this.isNullOrWhitespace(row.username)) {
            notes = row.username;
          }
        }

        const credential: ParsedCredential = {
          url: row.domain || '',
          username,
          password: row.password || '',
          notes: notes || undefined,
          name: row.label || this.extractDomain(row.domain) || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Blur CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
