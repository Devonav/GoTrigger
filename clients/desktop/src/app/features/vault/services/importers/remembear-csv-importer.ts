import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * RememBear CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/remembear-csv-importer.ts
 * CSV Format: name,website,username,password,notes,type,trash
 */
export class RememBearCsvImporter extends BaseImporter {
  readonly formatId = 'remembear-csv';
  readonly formatName = 'RememBear (CSV)';
  readonly formatDescription = 'CSV export from RememBear password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Skip trashed items
        if (row.trash === 'true') {
          continue;
        }

        // Only import login items (skip credit cards)
        const type = row.type || 'LoginItem';
        if (type !== 'LoginItem') {
          continue;
        }

        const credential: ParsedCredential = {
          url: row.website || '',
          username: row.username || '',
          password: row.password || '',
          notes: row.notes || undefined,
          name: row.name || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing RememBear CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
