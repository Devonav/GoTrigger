import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Passman JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/passman-json-importer.ts
 *
 * JSON Format (array):
 * [{
 *   "label": "GitHub",
 *   "username": "user@example.com",
 *   "email": "user@example.com",
 *   "password": "pass123",
 *   "url": "https://github.com",
 *   "description": "My notes",
 *   "otp": {"secret": "TOTP_SECRET"},
 *   "tags": [{"text": "Work"}],
 *   "custom_fields": [{"label": "Key", "value": "Value", "field_type": "text"}]
 * }]
 */
export class PassmanJsonImporter extends BaseImporter {
  readonly formatId = 'passman-json';
  readonly formatName = 'Passman (JSON)';
  readonly formatDescription = 'JSON export from Passman password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid Passman JSON format');
      }

      const credentials: ParsedCredential[] = [];

      for (const item of data) {
        try {
          const username = item.username || item.email || '';
          const totp = item.otp?.secret || '';

          // Get folder from tags
          let folder = '';
          if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            folder = item.tags[0].text || '';
          }

          let notes = item.description || '';

          // Add email to notes if different from username
          if (item.email && item.email !== username) {
            notes = `Email: ${item.email}\n` + notes;
          }

          // Add custom fields
          if (item.custom_fields && Array.isArray(item.custom_fields)) {
            const customFields = item.custom_fields
              .filter((f: any) => f.field_type === 'text' || f.field_type === 'password')
              .map((f: any) => `${f.label}: ${f.value}`)
              .join('\n');

            if (customFields) {
              notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields;
            }
          }

          if (folder) {
            notes += (notes ? '\n' : '') + `Folder: ${folder}`;
          }

          const credential: ParsedCredential = {
            url: item.url || '',
            username,
            password: item.password || '',
            notes: notes || undefined,
            name: item.label || undefined,
            folder: folder || undefined,
            totp: totp || undefined
          };

          if (this.isValidCredential(credential)) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing Passman JSON item:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Passman JSON:', error);
      throw new Error('Invalid JSON format or not a Passman export');
    }
  }
}
