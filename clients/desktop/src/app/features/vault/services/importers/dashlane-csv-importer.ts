import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Dashlane CSV Importer
 * Adapted from Bitwarden's dashlane-csv-importer.ts
 * Market Share: ~15% (major consumer password manager)
 *
 * Dashlane exports multiple CSV formats:
 * 1. Credentials: username,password,url,title,note,otpSecret,category
 * 2. Payment Cards: account_name,cc_number,code,expiration_month,expiration_year,type
 * 3. IDs: type,number,name,issue_date,expiration_date,place_of_issue,state
 * 4. Personal Info: type,title,first_name,last_name,email,phone_number,address,city,zip,state,country
 * 5. Secure Notes: title,note
 *
 * This importer handles all types and converts non-login items to secure notes
 */
export class DashlaneCsvImporter extends BaseImporter {
  readonly formatId = 'dashlane-csv';
  readonly formatName = 'Dashlane (CSV)';
  readonly formatDescription = 'CSV export from Dashlane password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    if (rows.length === 0) {
      return credentials;
    }

    // Detect format by first row keys
    const firstRowKeys = Object.keys(rows[0]);

    for (const row of rows) {
      try {
        let credential: ParsedCredential | null = null;

        // Detect record type based on columns
        if (firstRowKeys[0] === 'username') {
          // Credentials record
          credential = this.parseCredentialRecord(row);
        } else if (firstRowKeys[0] === 'type' && firstRowKeys[1] === 'account_name') {
          // Payment card record
          credential = this.parsePaymentRecord(row);
        } else if (firstRowKeys[0] === 'type' && firstRowKeys[1] === 'number') {
          // ID record (passport, license, SSN, etc.)
          credential = this.parseIdRecord(row);
        } else if (firstRowKeys[0] === 'type' && firstRowKeys[1] === 'title') {
          // Personal information record
          credential = this.parsePersonalInfoRecord(row);
        } else if (firstRowKeys[0] === 'title' && firstRowKeys[1] === 'note') {
          // Secure note record
          credential = this.parseSecureNoteRecord(row);
        }

        if (credential) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Dashlane CSV row:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Parse credentials record (login items)
   */
  private parseCredentialRecord(row: any): ParsedCredential | null {
    const username = row.username || '';
    const password = row.password || '';
    const url = row.url || '';
    const title = row.title || '';
    const note = row.note || '';
    const otpSecret = row.otpsecret || row.otpurl || '';
    const category = row.category || '';

    let notes = note;
    if (otpSecret) {
      notes += (notes ? '\n' : '') + `TOTP: ${otpSecret}`;
    }
    if (category) {
      notes += (notes ? '\n' : '') + `Folder: ${category}`;
    }

    const credential: ParsedCredential = {
      url,
      username,
      password,
      notes: notes || undefined,
      name: title || undefined,
      folder: category || undefined,
      totp: otpSecret || undefined
    };

    return this.isValidCredential(credential) ? credential : null;
  }

  /**
   * Parse payment card record
   * Converts to credential with card details in notes
   */
  private parsePaymentRecord(row: any): ParsedCredential {
    const type = row.type || 'card';
    const accountName = row.account_name || '';
    const accountHolder = row.account_holder || '';

    let cardInfo = '';
    let username = accountHolder || accountName;
    let password = '';

    if (type === 'credit_card') {
      const ccNumber = row.cc_number || '';
      const code = row.code || '';
      const expMonth = row.expiration_month || '';
      const expYear = row.expiration_year || '';

      cardInfo = [
        `Type: Credit Card`,
        `Card Holder: ${accountName}`,
        `Card Number: ${ccNumber}`,
        `CVV: ${code}`,
        `Expiry: ${expMonth}/${expYear}`
      ].join('\n');

      password = ccNumber;
    } else if (type === 'bank') {
      const accountNumber = row.account_number || '';

      cardInfo = [
        `Type: Bank Account`,
        `Account Name: ${accountName}`,
        `Account Holder: ${accountHolder}`,
        `Account Number: ${accountNumber}`
      ].join('\n');

      password = accountNumber;
    }

    return {
      url: 'card://' + accountName,
      username,
      password,
      notes: cardInfo,
      name: accountName || 'Payment Card'
    };
  }

  /**
   * Parse ID record (passport, license, SSN, etc.)
   * Converts to credential with ID details in notes
   */
  private parseIdRecord(row: any): ParsedCredential {
    const type = row.type || '';
    const number = row.number || '';
    const name = row.name || '';
    const issueDate = row.issue_date || '';
    const expirationDate = row.expiration_date || '';
    const placeOfIssue = row.place_of_issue || '';
    const state = row.state || '';

    const nameParsed = this.parseFullName(name);
    const fullName = `${nameParsed.firstName} ${nameParsed.middleName} ${nameParsed.lastName}`.trim();

    const idInfo = [
      `Type: ${type}`,
      `Name: ${fullName}`,
      `Number: ${number}`,
      issueDate ? `Issue Date: ${issueDate}` : '',
      expirationDate ? `Expiration: ${expirationDate}` : '',
      placeOfIssue ? `Place of Issue: ${placeOfIssue}` : '',
      state ? `State: ${state}` : ''
    ].filter(Boolean).join('\n');

    return {
      url: `id://${type}`,
      username: fullName || 'Identity',
      password: number,
      notes: idInfo,
      name: `${fullName} ${type}`.trim() || 'ID Document'
    };
  }

  /**
   * Parse personal information record
   * Converts to credential with personal details in notes
   */
  private parsePersonalInfoRecord(row: any): ParsedCredential {
    const type = row.type || '';
    const title = row.title || '';
    const firstName = row.first_name || '';
    const lastName = row.last_name || '';
    const email = row.email || '';
    const phoneNumber = row.phone_number || '';
    const address = row.address || '';
    const city = row.city || '';
    const zip = row.zip || '';
    const state = row.state || '';
    const country = row.country || '';
    const itemName = row.item_name || '';

    const personalInfo = [
      title ? `Title: ${title}` : '',
      firstName || lastName ? `Name: ${firstName} ${lastName}`.trim() : '',
      email ? `Email: ${email}` : '',
      phoneNumber ? `Phone: ${phoneNumber}` : '',
      address ? `Address: ${address}` : '',
      city || state || zip ? `Location: ${city}, ${state} ${zip}`.trim() : '',
      country ? `Country: ${country}` : ''
    ].filter(Boolean).join('\n');

    const name = itemName || `${firstName} ${lastName}`.trim() || 'Personal Info';

    return {
      url: `personal://${type}`,
      username: email || `${firstName} ${lastName}`.trim() || 'Personal',
      password: phoneNumber || '',
      notes: personalInfo,
      name
    };
  }

  /**
   * Parse secure note record
   */
  private parseSecureNoteRecord(row: any): ParsedCredential {
    const title = row.title || '';
    const note = row.note || '';

    return {
      url: 'note://' + title,
      username: 'Secure Note',
      password: '',
      notes: note,
      name: title || 'Secure Note'
    };
  }
}
