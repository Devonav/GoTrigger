import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * mSecure CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/msecure-csv-importer.ts
 *
 * CSV Format (NO HEADER): Name,Type,Folder,Notes,URL,Username,Password,...
 * Special format: Some fields use "FieldName|index|value" - we extract the last part
 * Types: "Web Logins", "Login", "Credit Card", etc.
 */
export class MSecureCsvImporter extends BaseImporter {
  readonly formatId = 'msecure-csv';
  readonly formatName = 'mSecure (CSV)';
  readonly formatDescription = 'CSV export from mSecure password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, false); // No header row
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        if (row.length < 3) {
          continue; // Need at least name, type, folder
        }

        const name = row[0]?.split('|')[0] || ''; // Name may have | separator
        const type = row[1] || '';
        const folderRaw = row[2] || '';
        const folder = folderRaw !== 'Unassigned' ? folderRaw : '';

        // Only import Web Logins and Login types
        if (type !== 'Web Logins' && type !== 'Login') {
          continue; // Skip cards, notes, etc. for now
        }

        // Extract fields (may have "FieldName|index|value" format)
        const notes = row[3] ? row[3].replace(/\\n/g, '\n') : '';
        const url = this.extractValue(row[4]);
        const username = this.extractValue(row[5]);
        const password = this.extractValue(row[6]);

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined,
          name: name || undefined,
          folder: folder || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing mSecure CSV row:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Extract value from mSecure format "FieldName|index|value"
   * Returns the last part after the last |
   */
  private extractValue(value: string | undefined): string {
    if (!value) return '';

    // Check if it has the | separator format
    const parts = value.split('|');
    if (parts.length >= 3) {
      // Return everything after the last |
      const lastPipeIndex = value.lastIndexOf('|');
      return value.substring(lastPipeIndex + 1);
    }

    return value;
  }
}
