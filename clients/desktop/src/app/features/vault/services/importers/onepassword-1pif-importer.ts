import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * 1Password 1PIF Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/onepassword/onepassword-1pif-importer.ts
 *
 * 1PIF is 1Password's legacy export format (versions before 8)
 * Format: JSON objects separated by newlines (JSONL)
 * Each line: {"uuid":"...","typeName":"webforms.WebForm","title":"GitHub",...}
 *
 * Types:
 * - webforms.WebForm (login)
 * - securenotes.SecureNote (secure note)
 * - wallet.financial.CreditCard (credit card)
 * - identities.Identity (identity)
 */
export class OnePassword1PifImporter extends BaseImporter {
  readonly formatId = 'onepassword-1pif';
  readonly formatName = '1Password (1PIF)';
  readonly formatDescription = 'Legacy 1PIF export from 1Password (pre-v8)';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    // 1PIF format is JSON objects separated by newlines
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and lines that don't start with {
      if (!trimmed || trimmed[0] !== '{') {
        continue;
      }

      try {
        const item = JSON.parse(trimmed);

        // Skip trashed items
        if (item.trashed === true) {
          continue;
        }

        // Determine format type (standard vs WinOpVault)
        const isWinOpVault = !this.isNullOrWhitespace(item.hmac);

        const credential = isWinOpVault
          ? this.parseWinOpVaultItem(item)
          : this.parseStandardItem(item);

        if (credential) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing 1PIF line:', error);
        continue;
      }
    }

    return credentials;
  }

  private parseWinOpVaultItem(item: any): ParsedCredential | null {
    const overview = item.overview || {};
    const details = item.details || {};

    const name = overview.title || '';
    let notes = details.notesPlain || '';

    // Get URLs
    let urls: string[] = [];
    if (overview.URLs && Array.isArray(overview.URLs)) {
      urls = overview.URLs
        .filter((u: any) => u.u)
        .map((u: any) => u.u);
    }
    const url = urls.length > 0 ? urls[0] : '';

    if (urls.length > 1) {
      notes += (notes ? '\n\n' : '') + 'Additional URLs:\n' + urls.slice(1).join('\n');
    }

    // Get folder from tags
    let folder = '';
    if (overview.tags && Array.isArray(overview.tags) && overview.tags.length > 0) {
      folder = overview.tags[0];
    }

    let username = '';
    let password = details.password || '';

    // Parse fields
    if (details.fields && Array.isArray(details.fields)) {
      for (const field of details.fields) {
        if (field.designation === 'username' && field.value) {
          username = field.value;
        } else if (field.designation === 'password' && field.value) {
          password = field.value;
        } else if (field.name && field.value) {
          notes += (notes ? '\n' : '') + `${field.name}: ${field.value}`;
        }
      }
    }

    // Parse sections
    if (details.sections && Array.isArray(details.sections)) {
      for (const section of details.sections) {
        if (!section.fields || !Array.isArray(section.fields)) {
          continue;
        }

        for (const field of section.fields) {
          const key = field.n || field.t;
          const value = field.v;

          if (!key || !value) {
            continue;
          }

          if (key.toLowerCase().includes('username') && !username) {
            username = value;
          } else if (key.toLowerCase().includes('password') && !password) {
            password = value;
          } else if (key.toLowerCase().includes('totp')) {
            notes += (notes ? '\n' : '') + `TOTP: ${value}`;
          } else {
            notes += (notes ? '\n' : '') + `${key}: ${value}`;
          }
        }
      }
    }

    // Add folder to notes
    if (folder) {
      notes += (notes ? '\n' : '') + `Folder: ${folder}`;
    }

    return {
      url: url || 'note://' + name,
      username: username || 'Entry',
      password: password || '',
      notes: notes || undefined,
      name: name || undefined,
      folder: folder || undefined
    };
  }

  private parseStandardItem(item: any): ParsedCredential | null {
    const name = item.title || '';
    const typeName = item.typeName || '';
    const favorite = item.openContents?.faveIndex === 1;

    let notes = '';
    let url = item.location || '';
    let username = '';
    let password = '';
    let folder = '';

    // Get folder from folderUuid
    if (item.folderUuid) {
      folder = item.folderUuid;
    }

    // Parse secure data
    if (item.secureContents) {
      const sc = item.secureContents;

      // Notes
      if (sc.notesPlain) {
        notes = sc.notesPlain;
      }

      // Parse fields based on type
      if (typeName === 'webforms.WebForm' || typeName === 'passwords.Password') {
        // Login
        if (sc.fields && Array.isArray(sc.fields)) {
          for (const field of sc.fields) {
            if (field.designation === 'username' && field.value) {
              username = field.value;
            } else if (field.designation === 'password' && field.value) {
              password = field.value;
            } else if (field.name && field.value) {
              notes += (notes ? '\n' : '') + `${field.name}: ${field.value}`;
            }
          }
        }
      } else if (typeName === 'wallet.financial.CreditCard') {
        // Credit card - convert to notes
        const cardInfo = [
          sc.cardholder ? `Cardholder: ${sc.cardholder}` : '',
          sc.ccnum ? `Card Number: ${sc.ccnum}` : '',
          sc.cvv ? `CVV: ${sc.cvv}` : '',
          sc.expiry ? `Expiry: ${sc.expiry}` : ''
        ].filter(Boolean).join('\n');

        notes = notes ? `${notes}\n\n${cardInfo}` : cardInfo;
        username = sc.cardholder || 'Card';
        password = sc.ccnum || '';

      } else if (typeName === 'identities.Identity') {
        // Identity - convert to notes
        const identityInfo = [
          sc.firstname || sc.lastname ? `Name: ${sc.firstname || ''} ${sc.lastname || ''}`.trim() : '',
          sc.email ? `Email: ${sc.email}` : '',
          sc.address?.street ? `Address: ${sc.address.street}` : '',
          sc.address?.city ? `City: ${sc.address.city}` : '',
          sc.address?.state ? `State: ${sc.address.state}` : '',
          sc.address?.zip ? `Zip: ${sc.address.zip}` : '',
          sc.address?.country ? `Country: ${sc.address.country}` : ''
        ].filter(Boolean).join('\n');

        notes = notes ? `${notes}\n\n${identityInfo}` : identityInfo;
        username = sc.email || `${sc.firstname || ''} ${sc.lastname || ''}`.trim() || 'Identity';
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
      username: username || 'Entry',
      password: password || '',
      notes: notes || undefined,
      name: name || undefined,
      folder: folder || undefined
    };
  }
}
