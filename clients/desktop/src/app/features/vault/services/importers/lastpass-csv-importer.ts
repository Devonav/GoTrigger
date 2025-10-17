import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * LastPass CSV Importer
 * Market Share: 21.25% (largest third-party password manager)
 *
 * Format: url,username,password,totp,extra,name,grouping,fav
 * Example: https://www.facebook.com/login.php,username,password,,,Facebook,Social,0
 */
export class LastPassCsvImporter extends BaseImporter {
  readonly formatId = 'lastpass-csv';
  readonly formatName = 'LastPass (CSV)';
  readonly formatDescription = 'CSV export from LastPass password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // LastPass columns: url, username, password, totp, extra, name, grouping, fav
        let url = row.url || '';
        let username = row.username || '';
        let password = row.password || '';
        let totp = row.totp || '';
        let extra = row.extra || '';
        let name = row.name || '';
        let grouping = row.grouping || ''; // Folder/category
        const fav = row.fav || '';

        // Decode HTML entities (LastPass sometimes exports with HTML encoding)
        url = this.decodeHtmlEntities(url);
        username = this.decodeHtmlEntities(username);
        password = this.decodeHtmlEntities(password);
        totp = this.decodeHtmlEntities(totp);
        extra = this.decodeHtmlEntities(extra);
        name = this.decodeHtmlEntities(name);
        grouping = this.decodeHtmlEntities(grouping);

        // Build notes from extra fields
        let notes = extra || '';
        if (totp) {
          notes += (notes ? '\n' : '') + `TOTP: ${totp}`;
        }
        if (grouping) {
          notes += (notes ? '\n' : '') + `Folder: ${grouping}`;
        }
        if (fav === '1') {
          notes += (notes ? '\n' : '') + 'Favorite: Yes';
        }

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined,
          name: name || undefined,
          folder: grouping || undefined,
          totp: totp || undefined
        };

        credentials.push(credential);
      } catch (error) {
        console.warn('Error parsing LastPass row:', error);
        continue;
      }
    }

    return credentials;
  }
}
