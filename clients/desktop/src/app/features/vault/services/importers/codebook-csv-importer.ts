import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Codebook CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/codebook-csv-importer.ts
 *
 * CSV Format: Category,Favorite,Entry,Note,Username,Email,Password,TOTP,Website,Phone,PIN,Account,Date
 */
export class CodebookCsvImporter extends BaseImporter {
  readonly formatId = 'codebook-csv';
  readonly formatName = 'Codebook (CSV)';
  readonly formatDescription = 'CSV export from Codebook password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        const folder = row.Category || '';
        let notes = row.Note || '';

        // Add additional fields to notes
        const additionalFields: Array<[string, string]> = [
          ['Email', row.Email],
          ['Phone', row.Phone],
          ['PIN', row.PIN],
          ['Account', row.Account],
          ['Date', row.Date]
        ];

        // If username is provided, add email to notes (if different)
        if (!this.isNullOrWhitespace(row.Username) && !this.isNullOrWhitespace(row.Email)) {
          if (row.Username !== row.Email) {
            notes += (notes ? '\n' : '') + `Email: ${row.Email}`;
          }
        }

        // Add other additional fields
        for (const [label, value] of additionalFields) {
          if (label !== 'Email' && !this.isNullOrWhitespace(value)) {
            notes += (notes ? '\n' : '') + `${label}: ${value}`;
          }
        }

        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        const credential: ParsedCredential = {
          url: row.Website || '',
          username: row.Username || row.Email || '',
          password: row.Password || '',
          notes: notes || undefined,
          name: row.Entry || undefined,
          folder: folder || undefined,
          totp: row.TOTP || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Codebook CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
