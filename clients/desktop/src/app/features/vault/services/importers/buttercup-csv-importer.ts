import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Buttercup CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/buttercup-csv-importer.ts
 *
 * CSV Format: !group_id,!group_name,title,username,password,URL,id,[custom fields...]
 */
export class ButtercupCsvImporter extends BaseImporter {
  readonly formatId = 'buttercup-csv';
  readonly formatName = 'Buttercup (CSV)';
  readonly formatDescription = 'CSV export from Buttercup password manager';

  private readonly officialProps = ['!group_id', '!group_name', 'title', 'username', 'password', 'URL', 'id'];

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        const folder = row['!group_name'] || '';

        // Build notes from custom fields
        let notes = '';
        for (const prop in row) {
          if (row.hasOwnProperty(prop) && this.officialProps.indexOf(prop) === -1) {
            const value = row[prop];
            if (!this.isNullOrWhitespace(value)) {
              notes += (notes ? '\n' : '') + `${prop}: ${value}`;
            }
          }
        }

        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        const credential: ParsedCredential = {
          url: row.URL || '',
          username: row.username || '',
          password: row.password || '',
          notes: notes || undefined,
          name: row.title || undefined,
          folder: folder || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Buttercup CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
