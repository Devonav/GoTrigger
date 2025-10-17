import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Proton Pass JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/protonpass/protonpass-json-importer.ts
 *
 * Proton Pass is a privacy-focused password manager by Proton (ProtonMail)
 * Growing rapidly in popularity
 *
 * JSON Format:
 * {
 *   "encrypted": false,
 *   "vaults": {
 *     "vault-uuid": {
 *       "name": "Personal",
 *       "items": [{
 *         "itemId": "...",
 *         "state": 1 (active) | 2 (trashed),
 *         "pinned": false,
 *         "data": {
 *           "type": "login" | "note" | "creditCard" | "identity",
 *           "metadata": {
 *             "name": "GitHub",
 *             "note": "My notes"
 *           },
 *           "content": {
 *             "itemUsername": "user@example.com",
 *             "itemEmail": "email@example.com",
 *             "password": "pass123",
 *             "totpUri": "otpauth://...",
 *             "urls": ["https://github.com"]
 *           },
 *           "extraFields": []
 *         }
 *       }]
 *     }
 *   }
 * }
 */
export class ProtonPassJsonImporter extends BaseImporter {
  readonly formatId = 'protonpass-json';
  readonly formatName = 'Proton Pass (JSON)';
  readonly formatDescription = 'JSON export from Proton Pass password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.vaults || typeof data.vaults !== 'object') {
        throw new Error('Invalid Proton Pass JSON format');
      }

      // Check if encrypted
      if (data.encrypted === true) {
        throw new Error('Encrypted Proton Pass exports are not supported. Please export without encryption.');
      }

      const credentials: ParsedCredential[] = [];

      // Iterate through all vaults
      for (const vaultId in data.vaults) {
        if (!data.vaults.hasOwnProperty(vaultId)) {
          continue;
        }

        const vault = data.vaults[vaultId];
        const vaultName = vault.name || '';

        if (!vault.items || !Array.isArray(vault.items)) {
          continue;
        }

        for (const item of vault.items) {
          try {
            // Skip trashed items (state: 2 = trashed, 1 = active)
            if (item.state === 2) {
              continue;
            }

            const itemData = item.data || {};
            const metadata = itemData.metadata || {};
            const content = itemData.content || {};
            const itemType = itemData.type || 'login';

            const name = metadata.name || '';
            let notes = metadata.note || '';
            const pinned = item.pinned === true;

            let credential: ParsedCredential | null = null;

            switch (itemType) {
              case 'login':
                credential = this.parseLoginItem(content, name, notes, vaultName, pinned, itemData.extraFields);
                break;

              case 'note':
                credential = this.parseNoteItem(content, name, notes, vaultName);
                break;

              case 'creditCard':
                credential = this.parseCreditCardItem(content, name, notes, vaultName);
                break;

              case 'identity':
                credential = this.parseIdentityItem(content, name, notes, vaultName);
                break;

              default:
                console.warn(`Unknown Proton Pass item type: ${itemType}`);
                break;
            }

            if (credential) {
              credentials.push(credential);
            }
          } catch (error) {
            console.warn('Error parsing Proton Pass item:', error);
            continue;
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Proton Pass JSON:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid JSON format or not a Proton Pass export');
    }
  }

  private parseLoginItem(
    content: any,
    name: string,
    notes: string,
    vaultName: string,
    pinned: boolean,
    extraFields: any[]
  ): ParsedCredential {
    let username = content.itemUsername || content.itemEmail || '';
    const password = content.password || '';
    const totp = content.totpUri || '';

    // URLs can be array or string
    let urls: string[] = [];
    if (Array.isArray(content.urls)) {
      urls = content.urls.filter((u: string) => u);
    } else if (content.urls) {
      urls = [content.urls];
    }

    const url = urls.length > 0 ? urls[0] : '';

    // Add additional URLs to notes
    if (urls.length > 1) {
      notes += (notes ? '\n\n' : '') + 'Additional URLs:\n' + urls.slice(1).join('\n');
    }

    // Add email to notes if different from username
    if (content.itemEmail && content.itemEmail !== username) {
      notes += (notes ? '\n' : '') + `Email: ${content.itemEmail}`;
    }

    // Process extra fields
    if (extraFields && Array.isArray(extraFields)) {
      const customFields = extraFields
        .filter((f: any) => f.fieldName && f.data?.content)
        .map((f: any) => {
          const hidden = f.type === 'hidden' ? ' (hidden)' : '';
          return `${f.fieldName}${hidden}: ${f.data.content}`;
        });

      if (customFields.length > 0) {
        notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
      }
    }

    // Add vault name
    if (vaultName) {
      notes += (notes ? '\n' : '') + `Vault: ${vaultName}`;
    }

    // Add favorite status
    if (pinned) {
      notes += (notes ? '\n' : '') + 'Pinned: Yes';
    }

    return {
      url: url || 'note://' + name,
      username,
      password,
      notes: notes || undefined,
      name: name || undefined,
      folder: vaultName || undefined,
      totp: totp || undefined
    };
  }

  private parseNoteItem(content: any, name: string, notes: string, vaultName: string): ParsedCredential {
    // Secure note
    if (vaultName) {
      notes += (notes ? '\n' : '') + `Vault: ${vaultName}`;
    }

    return {
      url: 'note://' + name,
      username: 'Secure Note',
      password: '',
      notes: notes || undefined,
      name: name || 'Secure Note',
      folder: vaultName || undefined
    };
  }

  private parseCreditCardItem(content: any, name: string, notes: string, vaultName: string): ParsedCredential {
    const cardholderName = content.cardholderName || '';
    const cardNumber = content.number || '';
    const verificationNumber = content.verificationNumber || '';
    const expirationDate = content.expirationDate || '';
    const pin = content.pin || '';

    const cardInfo = [
      `Cardholder: ${cardholderName}`,
      `Card Number: ${cardNumber}`,
      `CVV: ${verificationNumber}`,
      `Expiry: ${expirationDate}`,
      pin ? `PIN: ${pin}` : ''
    ].filter(Boolean).join('\n');

    notes = notes ? `${notes}\n\n${cardInfo}` : cardInfo;

    if (vaultName) {
      notes += (notes ? '\n' : '') + `Vault: ${vaultName}`;
    }

    return {
      url: 'card://' + name,
      username: cardholderName || 'Card',
      password: cardNumber,
      notes: notes,
      name: name || 'Credit Card',
      folder: vaultName || undefined
    };
  }

  private parseIdentityItem(content: any, name: string, notes: string, vaultName: string): ParsedCredential {
    const identityFields = [
      content.fullName ? `Full Name: ${content.fullName}` : '',
      content.email ? `Email: ${content.email}` : '',
      content.phoneNumber ? `Phone: ${content.phoneNumber}` : '',
      content.company ? `Company: ${content.company}` : '',
      content.streetAddress ? `Address: ${content.streetAddress}` : '',
      content.city ? `City: ${content.city}` : '',
      content.stateOrProvince ? `State: ${content.stateOrProvince}` : '',
      content.zipOrPostalCode ? `Zip: ${content.zipOrPostalCode}` : '',
      content.countryOrRegion ? `Country: ${content.countryOrRegion}` : '',
      content.socialSecurityNumber ? `SSN: ${content.socialSecurityNumber}` : '',
      content.passportNumber ? `Passport: ${content.passportNumber}` : '',
      content.licenseNumber ? `License: ${content.licenseNumber}` : ''
    ].filter(Boolean).join('\n');

    notes = notes ? `${notes}\n\n${identityFields}` : identityFields;

    if (vaultName) {
      notes += (notes ? '\n' : '') + `Vault: ${vaultName}`;
    }

    return {
      url: 'identity://' + name,
      username: content.email || content.fullName || 'Identity',
      password: '',
      notes: notes,
      name: name || 'Identity',
      folder: vaultName || undefined
    };
  }
}
