import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Password Boss JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/passwordboss-json-importer.ts
 *
 * JSON Format:
 * {
 *   "folders": [{"id": "1", "name": "Work"}],
 *   "items": [{
 *     "name": "GitHub",
 *     "login_url": "https://github.com",
 *     "folder": "1",
 *     "type": "Login" | "CreditCard",
 *     "identifiers": {
 *       "username": "user@example.com",
 *       "password": "pass123",
 *       "totp": "otpauth://...",
 *       "notes": "My notes",
 *       "custom_fields": [{"name": "Key", "value": "Value"}],
 *       "cardNumber": "1234567890123456",
 *       "nameOnCard": "John Doe",
 *       "security_code": "123",
 *       "expires": "2025-12-31",
 *       "url": "https://example.com"
 *     }
 *   }]
 * }
 *
 * Supports:
 * - Login items (with TOTP support)
 * - Credit cards (converted to notes)
 * - Custom fields
 */
export class PasswordBossJsonImporter extends BaseImporter {
  readonly formatId = 'passwordboss-json';
  readonly formatName = 'Password Boss (JSON)';
  readonly formatDescription = 'JSON export from Password Boss password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid Password Boss JSON format');
      }

      const credentials: ParsedCredential[] = [];

      // Build folder map (id -> name)
      const folderMap = new Map<string, string>();
      if (data.folders && Array.isArray(data.folders)) {
        for (const folder of data.folders) {
          if (folder.id && folder.name) {
            folderMap.set(folder.id, folder.name);
          }
        }
      }

      for (const item of data.items) {
        try {
          if (!item.identifiers) {
            continue;
          }

          // Get folder name
          let folder = '';
          if (item.folder && folderMap.has(item.folder)) {
            folder = folderMap.get(item.folder) || '';
          }

          const itemType = item.type || 'Login';
          const identifiers = item.identifiers;

          // Clean up notes (replace escaped newlines)
          let notes = identifiers.notes || '';
          notes = notes.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

          let credential: ParsedCredential;

          if (itemType === 'CreditCard') {
            // Credit Card
            const cardNumber = identifiers.cardNumber || '';
            const nameOnCard = identifiers.nameOnCard || '';
            const securityCode = identifiers.security_code || '';
            const expires = identifiers.expires || '';

            // Parse expiration date if present
            let expiryText = expires;
            if (expires) {
              try {
                const expDate = new Date(expires);
                const month = expDate.getMonth() + 1;
                const year = expDate.getFullYear();
                expiryText = `${month.toString().padStart(2, '0')}/${year}`;
              } catch {
                // Keep original format
              }
            }

            const cardInfo = [
              `Cardholder: ${nameOnCard}`,
              `Card Number: ${cardNumber}`,
              `CVV: ${securityCode}`,
              `Expiry: ${expiryText}`
            ].filter((line) => !line.endsWith(': ')).join('\n');

            notes = notes ? `${notes}\n\n${cardInfo}` : cardInfo;

            credential = {
              url: 'card://' + (item.name || 'Card'),
              username: nameOnCard || 'Card',
              password: cardNumber,
              notes: notes || undefined,
              name: item.name || 'Credit Card',
              folder: folder || undefined
            };

          } else {
            // Login
            const username = identifiers.username || identifiers.email || '';
            const password = identifiers.password || '';
            const totp = identifiers.totp || '';
            let url = item.login_url || identifiers.url || '';

            // Handle custom fields
            if (identifiers.custom_fields && Array.isArray(identifiers.custom_fields)) {
              const customFieldsText = identifiers.custom_fields
                .filter((cf: any) => cf.name && cf.value)
                .map((cf: any) => `${cf.name}: ${cf.value}`)
                .join('\n');

              if (customFieldsText) {
                notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFieldsText;
              }
            }

            // Process other identifiers as custom fields
            for (const key in identifiers) {
              if (identifiers.hasOwnProperty(key)) {
                const value = identifiers[key];

                // Skip known fields
                if (['username', 'email', 'password', 'totp', 'notes', 'custom_fields', 'url', 'ignoreItemInSecurityScore'].includes(key)) {
                  continue;
                }

                // Skip empty values
                if (!value || value.toString().trim() === '') {
                  continue;
                }

                // Add as custom field
                notes += (notes ? '\n' : '') + `${key}: ${value}`;
              }
            }

            if (folder) {
              notes += (notes ? '\n' : '') + `Folder: ${folder}`;
            }

            credential = {
              url: url,
              username: username,
              password: password,
              notes: notes || undefined,
              name: item.name || undefined,
              folder: folder || undefined,
              totp: totp || undefined
            };
          }

          // For login items, validate required fields
          if (itemType === 'Login' && !this.isValidCredential(credential)) {
            continue;
          }

          credentials.push(credential);
        } catch (error) {
          console.warn('Error parsing Password Boss JSON item:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Password Boss JSON:', error);
      throw new Error('Invalid JSON format or not a Password Boss export');
    }
  }
}
