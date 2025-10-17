import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Avast Passwords JSON Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/avast/avast-json-importer.ts
 *
 * JSON Format:
 * {
 *   "logins": [{
 *     "custName": "GitHub",
 *     "url": "https://github.com",
 *     "loginName": "user@example.com",
 *     "pwd": "password123",
 *     "note": "My notes"
 *   }],
 *   "notes": [{
 *     "label": "My Note",
 *     "text": "Note content"
 *   }],
 *   "cards": [{
 *     "custName": "My Card",
 *     "cardNumber": "1234567890123456",
 *     "holderName": "John Doe",
 *     "cvv": "123",
 *     "expirationDate": {"month": "12", "year": "2025"},
 *     "note": "Card notes"
 *   }]
 * }
 */
export class AvastJsonImporter extends BaseImporter {
  readonly formatId = 'avast-json';
  readonly formatName = 'Avast Passwords (JSON)';
  readonly formatDescription = 'JSON export from Avast Passwords';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);
      const credentials: ParsedCredential[] = [];

      // Process logins
      if (data.logins && Array.isArray(data.logins)) {
        for (const login of data.logins) {
          try {
            const credential: ParsedCredential = {
              url: login.url || '',
              username: login.loginName || '',
              password: login.pwd || '',
              notes: login.note || undefined,
              name: login.custName || undefined
            };

            if (this.isValidCredential(credential)) {
              credentials.push(credential);
            }
          } catch (error) {
            console.warn('Error parsing Avast JSON login:', error);
            continue;
          }
        }
      }

      // Process secure notes
      if (data.notes && Array.isArray(data.notes)) {
        for (const note of data.notes) {
          try {
            const credential: ParsedCredential = {
              url: 'note://' + (note.label || 'Note'),
              username: 'Secure Note',
              password: '',
              notes: note.text || '',
              name: note.label || 'Secure Note'
            };

            credentials.push(credential);
          } catch (error) {
            console.warn('Error parsing Avast JSON note:', error);
            continue;
          }
        }
      }

      // Process credit cards (convert to notes)
      if (data.cards && Array.isArray(data.cards)) {
        for (const card of data.cards) {
          try {
            const expiryMonth = card.expirationDate?.month || '';
            const expiryYear = card.expirationDate?.year || '';
            const expiry = expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : '';

            const cardInfo = [
              `Cardholder: ${card.holderName || ''}`,
              `Card Number: ${card.cardNumber || ''}`,
              `CVV: ${card.cvv || ''}`,
              expiry ? `Expiry: ${expiry}` : ''
            ].filter((line) => !line.endsWith(': ')).join('\n');

            let notes = card.note || '';
            notes = notes ? `${notes}\n\n${cardInfo}` : cardInfo;

            const credential: ParsedCredential = {
              url: 'card://' + (card.custName || 'Card'),
              username: card.holderName || 'Card',
              password: card.cardNumber || '',
              notes: notes,
              name: card.custName || 'Credit Card'
            };

            credentials.push(credential);
          } catch (error) {
            console.warn('Error parsing Avast JSON card:', error);
            continue;
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Avast JSON:', error);
      throw new Error('Invalid JSON format or not an Avast export');
    }
  }
}
