import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Bitwarden JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/bitwarden/bitwarden-json-importer.ts
 *
 * Bitwarden's full JSON export format with folders/collections
 * JSON Format:
 * {
 *   "encrypted": false,
 *   "folders": [
 *     {"id": "uuid", "name": "Work"}
 *   ],
 *   "items": [{
 *     "id": "uuid",
 *     "type": 1 (login) | 2 (note) | 3 (card) | 4 (identity),
 *     "name": "GitHub",
 *     "notes": "My notes",
 *     "favorite": false,
 *     "folderId": "uuid",
 *     "login": {
 *       "username": "user@example.com",
 *       "password": "pass123",
 *       "totp": "otpauth://...",
 *       "uris": [{"uri": "https://github.com"}]
 *     },
 *     "fields": [],
 *     "passwordHistory": []
 *   }]
 * }
 */
export class BitwardenJsonImporter extends BaseImporter {
  readonly formatId = 'bitwarden-json';
  readonly formatName = 'Bitwarden (JSON)';
  readonly formatDescription = 'JSON export from Bitwarden (full format with folders)';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid Bitwarden JSON format');
      }

      // Check if encrypted
      if (data.encrypted === true) {
        throw new Error('Encrypted Bitwarden exports are not supported. Please export without encryption.');
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
          const type = item.type || 1; // 1=login, 2=note, 3=card, 4=identity
          const name = item.name || '';
          let notes = item.notes || '';
          const favorite = item.favorite === true;

          // Get folder name
          let folder = '';
          if (item.folderId && folderMap.has(item.folderId)) {
            folder = folderMap.get(item.folderId) || '';
          }

          let credential: ParsedCredential | null = null;

          switch (type) {
            case 1: // Login
              credential = this.parseLoginItem(item, name, notes, folder, favorite);
              break;

            case 2: // Secure Note
              credential = this.parseNoteItem(item, name, notes, folder);
              break;

            case 3: // Card
              credential = this.parseCardItem(item, name, notes, folder);
              break;

            case 4: // Identity
              credential = this.parseIdentityItem(item, name, notes, folder);
              break;

            default:
              console.warn(`Unknown Bitwarden item type: ${type}`);
              break;
          }

          if (credential) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing Bitwarden JSON item:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Bitwarden JSON:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid JSON format or not a Bitwarden export');
    }
  }

  private parseLoginItem(item: any, name: string, notes: string, folder: string, favorite: boolean): ParsedCredential {
    const login = item.login || {};
    const username = login.username || '';
    const password = login.password || '';
    const totp = login.totp || '';

    // Parse URIs
    let urls: string[] = [];
    if (login.uris && Array.isArray(login.uris)) {
      urls = login.uris
        .filter((u: any) => u.uri)
        .map((u: any) => u.uri);
    }

    const url = urls.length > 0 ? urls[0] : '';

    // Add additional URLs to notes
    if (urls.length > 1) {
      notes += (notes ? '\n\n' : '') + 'Additional URLs:\n' + urls.slice(1).join('\n');
    }

    // Process custom fields
    if (item.fields && Array.isArray(item.fields)) {
      const customFields = item.fields
        .filter((f: any) => f.name && f.value)
        .map((f: any) => {
          const type = f.type === 1 ? ' (hidden)' : '';
          return `${f.name}${type}: ${f.value}`;
        });

      if (customFields.length > 0) {
        notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
      }
    }

    // Add folder to notes
    if (folder) {
      notes += (notes ? '\n' : '') + `Folder: ${folder}`;
    }

    // Add favorite status
    if (favorite) {
      notes += (notes ? '\n' : '') + 'Favorite: Yes';
    }

    return {
      url: url || 'note://' + name,
      username,
      password,
      notes: notes || undefined,
      name: name || undefined,
      folder: folder || undefined,
      totp: totp || undefined
    };
  }

  private parseNoteItem(item: any, name: string, notes: string, folder: string): ParsedCredential {
    if (folder) {
      notes += (notes ? '\n' : '') + `Folder: ${folder}`;
    }

    return {
      url: 'note://' + name,
      username: 'Secure Note',
      password: '',
      notes: notes || undefined,
      name: name || 'Secure Note',
      folder: folder || undefined
    };
  }

  private parseCardItem(item: any, name: string, notes: string, folder: string): ParsedCredential {
    const card = item.card || {};
    const cardholderName = card.cardholderName || '';
    const number = card.number || '';
    const code = card.code || '';
    const expMonth = card.expMonth || '';
    const expYear = card.expYear || '';

    const cardInfo = [
      `Cardholder: ${cardholderName}`,
      `Card Number: ${number}`,
      `CVV: ${code}`,
      `Expiry: ${expMonth}/${expYear}`,
      card.brand ? `Brand: ${card.brand}` : ''
    ].filter(Boolean).join('\n');

    notes = notes ? `${notes}\n\n${cardInfo}` : cardInfo;

    if (folder) {
      notes += '\n' + `Folder: ${folder}`;
    }

    return {
      url: 'card://' + name,
      username: cardholderName || 'Card',
      password: number,
      notes: notes,
      name: name || 'Credit Card',
      folder: folder || undefined
    };
  }

  private parseIdentityItem(item: any, name: string, notes: string, folder: string): ParsedCredential {
    const identity = item.identity || {};

    const identityFields = [
      identity.title ? `Title: ${identity.title}` : '',
      identity.firstName || identity.lastName ? `Name: ${identity.firstName || ''} ${identity.middleName || ''} ${identity.lastName || ''}`.trim() : '',
      identity.email ? `Email: ${identity.email}` : '',
      identity.phone ? `Phone: ${identity.phone}` : '',
      identity.company ? `Company: ${identity.company}` : '',
      identity.address1 ? `Address: ${identity.address1}` : '',
      identity.address2 ? `Address 2: ${identity.address2}` : '',
      identity.city || identity.state ? `Location: ${identity.city || ''}, ${identity.state || ''}`.trim() : '',
      identity.postalCode ? `Zip: ${identity.postalCode}` : '',
      identity.country ? `Country: ${identity.country}` : '',
      identity.ssn ? `SSN: ${identity.ssn}` : '',
      identity.passportNumber ? `Passport: ${identity.passportNumber}` : '',
      identity.licenseNumber ? `License: ${identity.licenseNumber}` : ''
    ].filter(Boolean).join('\n');

    notes = notes ? `${notes}\n\n${identityFields}` : identityFields;

    if (folder) {
      notes += '\n' + `Folder: ${folder}`;
    }

    return {
      url: 'identity://' + name,
      username: identity.email || `${identity.firstName || ''} ${identity.lastName || ''}`.trim() || 'Identity',
      password: '',
      notes: notes,
      name: name || 'Identity',
      folder: folder || undefined
    };
  }
}
