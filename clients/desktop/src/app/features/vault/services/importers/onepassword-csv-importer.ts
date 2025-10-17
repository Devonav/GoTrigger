import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * 1Password CSV Importer
 * Market Share: ~25% (major premium password manager)
 *
 * Format varies by export type, but common format is:
 * title,website,username,password,notes,type,name,folder
 *
 * Note: 1Password's .1pux/.1pif formats are proprietary JSON-based.
 * This importer handles basic CSV exports only.
 */
export class OnePasswordCsvImporter extends BaseImporter {
  readonly formatId = '1password-csv';
  readonly formatName = '1Password (CSV)';
  readonly formatDescription = 'CSV export from 1Password password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // 1Password CSV columns vary, so we check multiple field names
        const title = row.title || row.name || '';
        const url = row.website || row.url || row.login_url || '';
        const username = row.username || row.login_username || '';
        const password = row.password || row.login_password || '';
        let notes = row.notes || row.note || '';
        const folder = row.folder || row.category || '';
        const type = row.type || '';

        // Add type and folder to notes
        if (type) {
          notes = notes ? `${notes}\n\nType: ${type}` : `Type: ${type}`;
        }
        if (folder) {
          notes = notes ? `${notes}\nFolder: ${folder}` : `Folder: ${folder}`;
        }

        const credential: ParsedCredential = {
          url: url || 'https://unknown.com',
          username,
          password,
          notes: notes || undefined,
          name: title || undefined,
          folder: folder || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing 1Password CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
