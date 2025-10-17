import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * RoboForm CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/roboform-csv-importer.ts
 *
 * CSV Format: Name,Url,Login,Pwd,Note,Folder
 * Example: GitHub,https://github.com,user@example.com,password123,My notes,Work
 *
 * Note: RoboForm has complex Rf_fields format that we're skipping for now
 */
export class RoboFormCsvImporter extends BaseImporter {
  readonly formatId = 'roboform-csv';
  readonly formatName = 'RoboForm (CSV)';
  readonly formatDescription = 'CSV export from RoboForm password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // RoboForm folder names may start with /, remove it
        let folder = row.Folder || '';
        if (folder.startsWith('/')) {
          folder = folder.substring(1);
        }

        const credential: ParsedCredential = {
          url: row.Url || '',
          username: row.Login || '',
          password: row.Pwd || '',
          notes: row.Note || undefined,
          name: row.Name || undefined,
          folder: folder || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing RoboForm CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
