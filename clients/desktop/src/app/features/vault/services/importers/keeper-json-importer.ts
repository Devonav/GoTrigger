import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Keeper Security JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/keeper/keeper-json-importer.ts
 *
 * JSON Format:
 * {
 *   "records": [{
 *     "title": "GitHub",
 *     "login": "user@example.com",
 *     "password": "password123",
 *     "login_url": "https://github.com",
 *     "notes": "My notes",
 *     "custom_fields": {
 *       "TFC:Keeper": "TOTP_SECRET",
 *       "Custom Field": "Value"
 *     },
 *     "folders": [
 *       {"folder": "Work"},
 *       {"shared_folder": "Team"}
 *     ]
 *   }]
 * }
 */
export class KeeperJsonImporter extends BaseImporter {
  readonly formatId = 'keeper-json';
  readonly formatName = 'Keeper Security (JSON)';
  readonly formatDescription = 'JSON export from Keeper Security password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.records || !Array.isArray(data.records) || data.records.length === 0) {
        throw new Error('Invalid Keeper JSON format');
      }

      const credentials: ParsedCredential[] = [];

      for (const record of data.records) {
        try {
          let notes = record.notes || '';
          let totp = '';

          // Extract folder from folders array
          let folder = '';
          if (record.folders && Array.isArray(record.folders) && record.folders.length > 0) {
            const firstFolder = record.folders[0];
            folder = firstFolder.folder || firstFolder.shared_folder || '';
          }

          // Process custom fields
          if (record.custom_fields && typeof record.custom_fields === 'object') {
            const customFieldEntries: string[] = [];

            for (const key in record.custom_fields) {
              if (record.custom_fields.hasOwnProperty(key)) {
                const value = record.custom_fields[key];

                // Special handling for TOTP
                if (key === 'TFC:Keeper' && value) {
                  totp = value;
                } else if (value) {
                  customFieldEntries.push(`${key}: ${value}`);
                }
              }
            }

            // Add custom fields to notes
            if (customFieldEntries.length > 0) {
              notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFieldEntries.join('\n');
            }
          }

          // Add folder to notes
          if (folder) {
            notes += (notes ? '\n' : '') + `Folder: ${folder}`;
          }

          const credential: ParsedCredential = {
            url: record.login_url || '',
            username: record.login || '',
            password: record.password || '',
            notes: notes || undefined,
            name: record.title || undefined,
            folder: folder || undefined,
            totp: totp || undefined
          };

          if (this.isValidCredential(credential)) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing Keeper JSON record:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Keeper JSON:', error);
      throw new Error('Invalid JSON format or not a Keeper export');
    }
  }
}
