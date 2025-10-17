import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Encryptr CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/encryptr-csv-importer.ts
 *
 * CSV Format: Label,Entry Type,Username,Password,Site URL,Notes,Text
 * Note: Only imports "Password" entry types (skips "Credit Card" for now)
 */
export class EncryptrCsvImporter extends BaseImporter {
  readonly formatId = 'encryptr-csv';
  readonly formatName = 'Encryptr (CSV)';
  readonly formatDescription = 'CSV export from Encryptr password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        // Only import password entries (skip credit cards)
        const entryType = row['Entry Type'];
        if (entryType !== 'Password') {
          continue;
        }

        // Combine Notes and Text fields
        let notes = row.Notes || '';
        const text = row.Text || '';
        if (!this.isNullOrWhitespace(text)) {
          notes += (notes ? '\n\n' : '') + text;
        }

        const credential: ParsedCredential = {
          url: row['Site URL'] || '',
          username: row.Username || '',
          password: row.Password || '',
          notes: notes || undefined,
          name: row.Label || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Encryptr CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
