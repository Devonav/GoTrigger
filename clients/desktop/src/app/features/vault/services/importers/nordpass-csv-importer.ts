import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * NordPass CSV Importer
 * Adapted from Bitwarden's nordpass-csv-importer.ts
 * Market Share: Growing rapidly (by NordVPN team)
 *
 * Format: name,url,additional_urls,username,password,note,cardholdername,cardnumber,cvc,expirydate,zipcode,folder,full_name,phone_number,email,address1,address2,city,country,state,type,custom_fields
 * Example: GitHub,https://github.com,,user@example.com,pass123,My notes,,,,,,Work,John Doe,555-1234,john@example.com,123 Main St,,NYC,USA,NY,password,
 *
 * Supports:
 * - Logins (type: "password")
 * - Credit cards (type: "credit_card", converted to notes)
 * - Identities (type: "identity", converted to notes)
 * - Secure notes (type: "note")
 * - Folders
 * - Custom fields (JSON array)
 */
export class NordPassCsvImporter extends BaseImporter {
  readonly formatId = 'nordpass-csv';
  readonly formatName = 'NordPass (CSV)';
  readonly formatDescription = 'CSV export from NordPass password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        const name = row.name || '';
        const url = row.url || '';
        const additionalUrls = row.additional_urls || '';
        const username = row.username || '';
        const password = row.password || '';
        let note = row.note || '';
        const folder = row.folder || '';
        const type = row.type || ''; // Type field for better detection

        // Card fields
        const cardholderName = row.cardholdername || '';
        const cardNumber = row.cardnumber || '';
        const cvc = row.cvc || '';
        const expiryDate = row.expirydate || '';
        const zipCode = row.zipcode || '';

        // Identity fields
        const fullName = row.full_name || '';
        const phoneNumber = row.phone_number || '';
        const email = row.email || '';
        const address1 = row.address1 || '';
        const address2 = row.address2 || '';
        const city = row.city || '';
        const country = row.country || '';
        const state = row.state || '';

        // Parse custom fields if present (JSON array)
        let customFieldsText = '';
        if (row.custom_fields) {
          try {
            const customFields = JSON.parse(row.custom_fields);
            if (Array.isArray(customFields) && customFields.length > 0) {
              customFieldsText = customFields
                .filter((f: any) => f.label && f.value)
                .map((f: any) => {
                  const fieldType = f.type === 'hidden' ? ' (hidden)' : '';
                  return `${f.label}${fieldType}: ${f.value}`;
                })
                .join('\n');
            }
          } catch {
            // Ignore JSON parse errors
          }
        }

        // Determine type - use explicit type field first, then fallback to heuristics
        let isCard = type === 'credit_card' || !!(cardholderName || cardNumber);
        let isIdentity = type === 'identity' || !!(fullName || phoneNumber || email || address1);
        let isNote = type === 'note';
        let isLogin = type === 'password' || !!(url || username || password);

        let credential: ParsedCredential;

        if (isCard) {
          // Credit card
          const cardInfo = [
            `Cardholder: ${cardholderName}`,
            `Card Number: ${cardNumber}`,
            `CVC: ${cvc}`,
            `Expiry: ${expiryDate}`,
            zipCode ? `Zip Code: ${zipCode}` : ''
          ].filter(Boolean).join('\n');

          note = note ? `${note}\n\n${cardInfo}` : cardInfo;

          // Add custom fields to notes
          if (customFieldsText) {
            note += (note ? '\n\n' : '') + 'Custom Fields:\n' + customFieldsText;
          }

          credential = {
            url: 'card://' + name,
            username: cardholderName || 'Card',
            password: cardNumber,
            notes: note,
            name: name || 'Credit Card',
            folder: folder || undefined
          };

        } else if (isIdentity) {
          // Identity
          const identityInfo = [
            `Full Name: ${fullName}`,
            email ? `Email: ${email}` : '',
            phoneNumber ? `Phone: ${phoneNumber}` : '',
            address1 ? `Address: ${address1}` : '',
            address2 ? `Address 2: ${address2}` : '',
            city || state ? `Location: ${city}, ${state}`.trim() : '',
            country ? `Country: ${country}` : ''
          ].filter(Boolean).join('\n');

          note = note ? `${note}\n\n${identityInfo}` : identityInfo;

          // Add custom fields to notes
          if (customFieldsText) {
            note += (note ? '\n\n' : '') + 'Custom Fields:\n' + customFieldsText;
          }

          credential = {
            url: 'identity://' + name,
            username: email || fullName || 'Identity',
            password: phoneNumber || '',
            notes: note,
            name: name || 'Identity',
            folder: folder || undefined
          };

        } else if (isLogin) {
          // Login
          if (additionalUrls) {
            try {
              // Parse additional URLs if it's JSON
              const additionalUrlsParsed = JSON.parse(additionalUrls);
              if (Array.isArray(additionalUrlsParsed) && additionalUrlsParsed.length > 0) {
                note = note ? `${note}\n\nAdditional URLs:\n${additionalUrlsParsed.join('\n')}` : `Additional URLs:\n${additionalUrlsParsed.join('\n')}`;
              }
            } catch {
              // If not JSON, treat as plain text
              note = note ? `${note}\n\nAdditional URLs:\n${additionalUrls}` : `Additional URLs:\n${additionalUrls}`;
            }
          }

          // Add custom fields to notes
          if (customFieldsText) {
            note += (note ? '\n\n' : '') + 'Custom Fields:\n' + customFieldsText;
          }

          if (folder) {
            note = note ? `${note}\n\nFolder: ${folder}` : `Folder: ${folder}`;
          }

          credential = {
            url,
            username,
            password,
            notes: note || undefined,
            name: name || undefined,
            folder: folder || undefined
          };

        } else {
          // Secure note
          // Add custom fields to notes
          if (customFieldsText) {
            note += (note ? '\n\n' : '') + 'Custom Fields:\n' + customFieldsText;
          }

          credential = {
            url: 'note://' + name,
            username: 'Secure Note',
            password: '',
            notes: note,
            name: name || 'Note',
            folder: folder || undefined
          };
        }

        if (isLogin && !this.isValidCredential(credential)) {
          continue; // Skip invalid login credentials
        }

        credentials.push(credential);
      } catch (error) {
        console.warn('Error parsing NordPass CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
