import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Enpass JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/enpass/enpass-json-importer.ts
 *
 * JSON Format:
 * {
 *   "folders": [{"title": "Work", "uuid": "abc123"}],
 *   "items": [{
 *     "title": "GitHub",
 *     "template_type": "login.default",
 *     "folders": ["abc123"],
 *     "favorite": 1,
 *     "fields": [
 *       {"type": "username", "value": "user@example.com", "label": "Username"},
 *       {"type": "password", "value": "pass123", "label": "Password"},
 *       {"type": "url", "value": "https://github.com"},
 *       {"type": "totp", "value": "otpauth://..."}
 *     ]
 *   }]
 * }
 */
export class EnpassJsonImporter extends BaseImporter {
  readonly formatId = 'enpass-json';
  readonly formatName = 'Enpass (JSON)';
  readonly formatDescription = 'JSON export from Enpass password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid Enpass JSON format');
      }

      const credentials: ParsedCredential[] = [];

      // Build folder map (uuid -> name)
      const folderMap = new Map<string, string>();
      if (data.folders && Array.isArray(data.folders)) {
        for (const folder of data.folders) {
          if (folder.uuid && folder.title) {
            folderMap.set(folder.uuid, folder.title);
          }
        }
      }

      for (const item of data.items) {
        try {
          const templateType = item.template_type || '';
          const favorite = item.favorite > 0;

          // Only import logins and password types
          const isLogin = templateType.startsWith('login.') || templateType.startsWith('password.');
          if (!isLogin && !item.fields?.some((f: any) => f.type === 'password')) {
            continue; // Skip cards, notes, etc.
          }

          const name = item.title || '';
          let notes = item.note || '';

          // Get folder name
          let folder = '';
          if (item.folders && Array.isArray(item.folders) && item.folders.length > 0) {
            folder = folderMap.get(item.folders[0]) || '';
          }

          // Parse fields
          const urls: string[] = [];
          let username = '';
          let password = '';
          let totp = '';
          const customFields: string[] = [];

          if (item.fields && Array.isArray(item.fields)) {
            for (const field of item.fields) {
              if (!field.value || field.type === 'section') {
                continue;
              }

              const fieldType = field.type?.toLowerCase();
              const fieldValue = field.value;

              if ((fieldType === 'username' || fieldType === 'email') && !username) {
                username = fieldValue;
              } else if (fieldType === 'password' && !password) {
                password = fieldValue;
              } else if (fieldType === 'url') {
                urls.push(fieldValue);
              } else if (fieldType === 'totp' && !totp) {
                totp = fieldValue;
              } else if (field.label) {
                // Custom field
                customFields.push(`${field.label}: ${fieldValue}`);
              }
            }
          }

          // Add custom fields to notes
          if (customFields.length > 0) {
            notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
          }

          // Add folder to notes
          if (folder) {
            notes += (notes ? '\n' : '') + `Folder: ${folder}`;
          }

          // Add favorite status
          if (favorite) {
            notes += (notes ? '\n' : '') + 'Favorite: Yes';
          }

          const credential: ParsedCredential = {
            url: urls[0] || '',
            username,
            password,
            notes: notes || undefined,
            name: name || undefined,
            folder: folder || undefined,
            totp: totp || undefined
          };

          // Add additional URLs to notes
          if (urls.length > 1) {
            const additionalUrls = urls.slice(1).join('\n');
            credential.notes = (credential.notes || '') + '\n\nAdditional URLs:\n' + additionalUrls;
          }

          if (this.isValidCredential(credential)) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing Enpass JSON item:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Enpass JSON:', error);
      throw new Error('Invalid JSON format or not an Enpass export');
    }
  }
}
