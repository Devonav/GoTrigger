import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Ascendo CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/ascendo-csv-importer.ts
 *
 * CSV Format (NO HEADER): name, field1, value1, field2, value2, ..., notes
 * Each row alternates between field names and values
 * First column: entry name
 * Last column: notes
 */
export class AscendoCsvImporter extends BaseImporter {
  readonly formatId = 'ascendo-csv';
  readonly formatName = 'Ascendo DataVault (CSV)';
  readonly formatDescription = 'CSV export from Ascendo DataVault password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, false); // NO HEADER
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        // Need at least name and notes (2 columns)
        if (row.length < 2) {
          continue;
        }

        const name = row[0] || '';
        const notes = row[row.length - 1] || '';

        let url = '';
        let username = '';
        let password = '';
        const additionalNotes: string[] = [];

        // Parse field/value pairs (middle columns)
        if (row.length > 2 && row.length % 2 === 0) {
          for (let i = 0; i < row.length - 2; i += 2) {
            const field = row[i + 1];
            const value = row[i + 2];

            if (this.isNullOrWhitespace(field) || this.isNullOrWhitespace(value)) {
              continue;
            }

            const fieldLower = field.toLowerCase();

            // Detect username field
            if (!username && this.usernameFieldNames.indexOf(fieldLower) > -1) {
              username = value;
            }
            // Detect password field
            else if (!password && this.passwordFieldNames.indexOf(fieldLower) > -1) {
              password = value;
            }
            // Detect URL field
            else if (!url && this.uriFieldNames.indexOf(fieldLower) > -1) {
              url = value;
            }
            // Store as additional field
            else {
              additionalNotes.push(`${field}: ${value}`);
            }
          }
        }

        let finalNotes = notes || '';
        if (additionalNotes.length > 0) {
          finalNotes += (finalNotes ? '\n' : '') + additionalNotes.join('\n');
        }

        const credential: ParsedCredential = {
          url: url || '',
          username: username || '',
          password: password || '',
          notes: finalNotes || undefined,
          name: name || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Ascendo CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
