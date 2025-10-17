import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Keeper Security CSV Importer
 * Adapted from Bitwarden's keeper-csv-importer.ts
 * Market Share: ~5% (popular enterprise password manager)
 *
 * Format (no header):
 * folder,title,username,password,url,notes,custom_field_1,custom_field_2,...
 *
 * Special handling:
 * - TOTP tokens stored as custom field "TFC:Keeper"
 * - Supports unlimited custom fields (pairs of key-value)
 * - Folder support
 */
export class KeeperCsvImporter extends BaseImporter {
  readonly formatId = 'keeper-csv';
  readonly formatName = 'Keeper Security (CSV)';
  readonly formatDescription = 'CSV export from Keeper Security password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, false); // No header row
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Keeper format: folder, title, username, password, url, notes, [custom_field_1, custom_field_2, ...]
        if (row.length < 6) {
          console.warn('Keeper CSV row has fewer than 6 columns, skipping');
          continue;
        }

        const folder = row[0] || '';
        const title = row[1] || '';
        const username = row[2] || '';
        const password = row[3] || '';
        const url = row[4] || '';
        let notes = row[5] || '';

        let totp = '';

        // Process custom fields (starting at index 7, in pairs)
        if (row.length > 7) {
          const customFields: string[] = [];

          for (let i = 7; i < row.length; i += 2) {
            const key = row[i];
            const value = row[i + 1];

            if (!key) continue;

            // Special handling for TOTP
            if (key === 'TFC:Keeper') {
              totp = value || '';
            } else if (value) {
              customFields.push(`${key}: ${value}`);
            }
          }

          // Add custom fields to notes
          if (customFields.length > 0) {
            notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
          }
        }

        // Add folder to notes
        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        // Add TOTP to notes
        if (totp) {
          notes += (notes ? '\n' : '') + `TOTP: ${totp}`;
        }

        const credential: ParsedCredential = {
          url: url,
          username: username,
          password: password,
          notes: notes || undefined,
          name: this.getValueOrDefault(title, '--'),
          folder: folder || undefined,
          totp: totp || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Keeper CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
