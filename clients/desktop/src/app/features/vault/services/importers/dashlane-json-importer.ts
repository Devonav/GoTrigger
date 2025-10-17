import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Dashlane JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/dashlane/dashlane-json-importer.ts
 *
 * JSON Format (French field names):
 * {
 *   "AUTHENTIFIANT": [{
 *     "title": "GitHub",
 *     "domain": "https://github.com",
 *     "login": "user@example.com",
 *     "secondaryLogin": "alt@example.com",
 *     "email": "email@example.com",
 *     "password": "password123",
 *     "note": "My notes"
 *   }],
 *   "PAYMENTMEANS_CREDITCARD": [{
 *     "bank": "Chase",
 *     "owner": "John Doe",
 *     "cardNumber": "1234567890123456"
 *   }],
 *   "ADDRESS": [{
 *     "addressName": "Home",
 *     "addressFull": "123 Main St",
 *     "city": "NYC",
 *     "state": "NY",
 *     "zipcode": "10001",
 *     "country": "US"
 *   }],
 *   "IDENTITY": [{
 *     "fullName": "John Doe",
 *     "pseudo": "johndoe"
 *   }],
 *   "BANKSTATEMENT": [...],
 *   "IDCARD": [...]
 * }
 */
export class DashlaneJsonImporter extends BaseImporter {
  readonly formatId = 'dashlane-json';
  readonly formatName = 'Dashlane (JSON)';
  readonly formatDescription = 'JSON export from Dashlane password manager';

  private readonly handledResults = new Set([
    'ADDRESS',
    'AUTHENTIFIANT',
    'BANKSTATEMENT',
    'IDCARD',
    'IDENTITY',
    'PAYMENTMEANS_CREDITCARD',
    'PAYMENTMEAN_PAYPAL',
    'EMAIL',
  ]);

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);
      const credentials: ParsedCredential[] = [];

      // Process authentication/login items
      if (data.AUTHENTIFIANT && Array.isArray(data.AUTHENTIFIANT)) {
        for (const item of data.AUTHENTIFIANT) {
          try {
            let username = item.login || item.secondaryLogin || '';
            let notes = item.note || '';

            // Add email to notes if different from username
            if (!username && item.email) {
              username = item.email;
            } else if (item.email && item.email !== username) {
              notes = `Email: ${item.email}\n${notes}`;
            }

            const credential: ParsedCredential = {
              url: item.domain || '',
              username,
              password: item.password || '',
              notes: notes || undefined,
              name: item.title || undefined
            };

            if (this.isValidCredential(credential)) {
              credentials.push(credential);
            }
          } catch (error) {
            console.warn('Error parsing Dashlane JSON login:', error);
            continue;
          }
        }
      }

      // Process credit cards (convert to notes)
      if (data.PAYMENTMEANS_CREDITCARD && Array.isArray(data.PAYMENTMEANS_CREDITCARD)) {
        for (const card of data.PAYMENTMEANS_CREDITCARD) {
          try {
            const cardInfo = [
              `Bank: ${card.bank || ''}`,
              `Card Holder: ${card.owner || ''}`,
              `Card Number: ${card.cardNumber || ''}`
            ].filter((line) => !line.endsWith(': ')).join('\n');

            const credential: ParsedCredential = {
              url: 'card://' + (card.bank || 'Card'),
              username: card.owner || 'Card',
              password: card.cardNumber || '',
              notes: cardInfo,
              name: card.bank || 'Credit Card'
            };

            credentials.push(credential);
          } catch (error) {
            console.warn('Error parsing Dashlane JSON card:', error);
            continue;
          }
        }
      }

      // Process addresses (convert to notes)
      if (data.ADDRESS && Array.isArray(data.ADDRESS)) {
        for (const addr of data.ADDRESS) {
          try {
            const addressInfo = [
              addr.addressFull || '',
              addr.city ? `City: ${addr.city}` : '',
              addr.state ? `State: ${addr.state}` : '',
              addr.zipcode ? `Zip: ${addr.zipcode}` : '',
              addr.country ? `Country: ${addr.country.toUpperCase()}` : ''
            ].filter(Boolean).join('\n');

            const credential: ParsedCredential = {
              url: 'address://' + (addr.addressName || 'Address'),
              username: addr.addressName || 'Address',
              password: '',
              notes: addressInfo,
              name: addr.addressName || 'Address'
            };

            credentials.push(credential);
          } catch (error) {
            console.warn('Error parsing Dashlane JSON address:', error);
            continue;
          }
        }
      }

      // Process identities (convert to notes)
      if (data.IDENTITY && Array.isArray(data.IDENTITY)) {
        for (const identity of data.IDENTITY) {
          try {
            const identityInfo = [
              `Full Name: ${identity.fullName || ''}`,
              identity.pseudo ? `Username: ${identity.pseudo}` : ''
            ].filter(Boolean).join('\n');

            const credential: ParsedCredential = {
              url: 'identity://' + (identity.fullName || 'Identity'),
              username: identity.pseudo || identity.fullName || 'Identity',
              password: '',
              notes: identityInfo,
              name: identity.fullName || 'Identity'
            };

            credentials.push(credential);
          } catch (error) {
            console.warn('Error parsing Dashlane JSON identity:', error);
            continue;
          }
        }
      }

      // Process bank statements and ID cards as secure notes
      const noteTypes = ['BANKSTATEMENT', 'IDCARD'];
      for (const type of noteTypes) {
        if (data[type] && Array.isArray(data[type])) {
          for (const item of data[type]) {
            try {
              const nameProperty = type === 'BANKSTATEMENT' ? 'BankAccountName' : 'Fullname';
              const name = item[nameProperty] || 'Note';

              // Convert all properties to notes
              const noteLines: string[] = [];
              for (const key in item) {
                if (item.hasOwnProperty(key) && key !== nameProperty && item[key]) {
                  noteLines.push(`${key}: ${item[key]}`);
                }
              }

              const credential: ParsedCredential = {
                url: 'note://' + name,
                username: 'Secure Note',
                password: '',
                notes: noteLines.join('\n'),
                name
              };

              credentials.push(credential);
            } catch (error) {
              console.warn(`Error parsing Dashlane JSON ${type}:`, error);
              continue;
            }
          }
        }
      }

      // Process any unhandled types as generic notes
      for (const key in data) {
        if (data.hasOwnProperty(key) && !this.handledResults.has(key)) {
          if (Array.isArray(data[key])) {
            for (const item of data[key]) {
              try {
                const noteLines: string[] = [];
                for (const prop in item) {
                  if (item.hasOwnProperty(prop) && item[prop]) {
                    noteLines.push(`${prop}: ${item[prop]}`);
                  }
                }

                const credential: ParsedCredential = {
                  url: 'note://' + key,
                  username: 'Generic Note',
                  password: '',
                  notes: noteLines.join('\n'),
                  name: key
                };

                credentials.push(credential);
              } catch (error) {
                console.warn(`Error parsing Dashlane JSON ${key}:`, error);
                continue;
              }
            }
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Dashlane JSON:', error);
      throw new Error('Invalid JSON format or not a Dashlane export');
    }
  }
}
