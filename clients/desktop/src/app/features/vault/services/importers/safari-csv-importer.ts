import { BaseImporter, ParsedCredential } from './base-importer';
import Papa from 'papaparse';

/**
 * Safari CSV Importer
 * macOS/iOS ecosystem password manager
 *
 * Format: Title,Url,Username,Password,OTPAuth
 * Note: Safari is case-sensitive with column headers
 */
export class SafariCsvImporter extends BaseImporter {
  readonly formatId = 'safari-csv';
  readonly formatName = 'Safari (CSV)';
  readonly formatDescription = 'CSV export from Safari/iCloud Keychain';

  async parse(content: string): Promise<ParsedCredential[]> {
    // Safari uses capital letters, so we need to handle case
    const rows = this.parseCsvPreservingCase(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Safari columns: Title, Url, Username, Password, OTPAuth
        // Try both lowercase and capitalized versions
        const title = row.Title || row.title || '';
        const url = row.Url || row.url || '';
        const username = row.Username || row.username || '';
        const password = row.Password || row.password || '';
        const otpAuth = row.OTPAuth || row.otpauth || '';

        // Build notes from OTPAuth if available
        let notes = '';
        if (otpAuth) {
          notes = `OTP: ${otpAuth}`;
        }

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined,
          name: title || undefined
        };

        credentials.push(credential);
      } catch (error) {
        console.warn('Error parsing Safari row:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Parse CSV preserving case for Safari compatibility
   * Safari exports with capitalized headers (Title, Url, Username, Password, OTPAuth)
   */
  private parseCsvPreservingCase(data: string, header: boolean = true): any[] {
    try {
      const parseResult = Papa.parse(data, {
        header: header,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(), // Don't lowercase!
        transform: (value: string) => this.sanitizeValue(value)
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        parseResult.errors.forEach((e: any) => {
          if (e.row != null) {
            console.warn(`CSV parse warning at row ${e.row}: ${e.message}`);
          }
        });
      }

      return parseResult.data || [];
    } catch (error) {
      console.error('Failed to parse Safari CSV:', error);
      return [];
    }
  }
}
