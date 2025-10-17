import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * KeePassX CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/keepassx-csv-importer.ts
 *
 * CSV Format: Group,Title,Username,Password,URL,Notes,TOTP
 */
export class KeePassXCsvImporter extends BaseImporter {
  readonly formatId = 'keepassx-csv';
  readonly formatName = 'KeePassX (CSV)';
  readonly formatDescription = 'CSV export from KeePassX password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        // Skip entries without title
        if (this.isNullOrWhitespace(row.title)) {
          continue;
        }

        // Strip "Root/" prefix from group/folder
        let folder = row.group || '';
        if (folder.startsWith('Root/')) {
          folder = folder.replace('Root/', '');
        }

        let notes = row.notes || '';
        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        const credential: ParsedCredential = {
          url: row.url || '',
          username: row.username || '',
          password: row.password || '',
          notes: notes || undefined,
          name: row.title || undefined,
          folder: folder || undefined,
          totp: row.totp || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing KeePassX CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
