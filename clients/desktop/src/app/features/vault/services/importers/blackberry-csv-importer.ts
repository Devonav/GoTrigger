import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * BlackBerry Password Keeper CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/blackberry-csv-importer.ts
 *
 * CSV Format: grouping,fav,name,url,username,password,extra
 * Note: Skip entries with grouping="list"
 * Note: If grouping="note", don't import url/username/password
 */
export class BlackBerryCsvImporter extends BaseImporter {
  readonly formatId = 'blackberry-csv';
  readonly formatName = 'BlackBerry Password Keeper (CSV)';
  readonly formatDescription = 'CSV export from BlackBerry Password Keeper';

  async parse(content: string): Promise<ParsedCredential[]> {
    const results = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of results) {
      try {
        // Skip list entries
        if (row.grouping === 'list') {
          continue;
        }

        const isNote = row.grouping === 'note';

        const credential: ParsedCredential = {
          url: isNote ? '' : (row.url || ''),
          username: isNote ? '' : (row.username || ''),
          password: isNote ? '' : (row.password || ''),
          notes: row.extra || undefined,
          name: row.name || undefined
        };

        // For notes, we still need at least name to be valid
        if (isNote) {
          if (!this.isNullOrWhitespace(row.name)) {
            credentials.push(credential);
          }
        } else if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing BlackBerry CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
