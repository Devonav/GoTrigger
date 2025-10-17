import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Bitwarden CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/bitwarden/bitwarden-csv-importer.ts
 *
 * CSV Format: folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
 * Example: Personal,1,login,GitHub,My notes,,0,https://github.com,user@example.com,password123,otpauth://...
 */
export class BitwardenCsvImporter extends BaseImporter {
  readonly formatId = 'bitwarden-csv';
  readonly formatName = 'Bitwarden (CSV)';
  readonly formatDescription = 'CSV export from Bitwarden password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Skip secure notes (type === 'note')
        const type = row.type?.toLowerCase();
        if (type === 'note') {
          continue; // We only import logins for now
        }

        // Bitwarden supports both prefixed (login_*) and non-prefixed column names
        const url = row.login_uri || row.uri || '';
        const username = row.login_username || row.username || '';
        const password = row.login_password || row.password || '';
        const totp = row.login_totp || row.totp || '';
        const name = row.name || '';
        const folder = row.folder || '';
        let notes = row.notes || '';

        // Parse custom fields if present (format: "key: value" separated by newlines)
        if (row.fields) {
          const fieldLines = row.fields.split(/\r?\n/).filter((line: string) => line.trim());
          if (fieldLines.length > 0) {
            const customFields = fieldLines
              .map((line: string) => {
                const delimPos = line.lastIndexOf(': ');
                if (delimPos > 0) {
                  const key = line.substring(0, delimPos);
                  const value = line.substring(delimPos + 2);
                  return `${key}: ${value}`;
                }
                return line;
              })
              .join('\n');

            notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields;
          }
        }

        // Add folder to notes
        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        // Add favorite status
        if (row.favorite === '1' || row.favorite === 'true') {
          notes += (notes ? '\n' : '') + 'Favorite: Yes';
        }

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined,
          name: name || undefined,
          folder: folder || undefined,
          totp: totp || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Bitwarden CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
