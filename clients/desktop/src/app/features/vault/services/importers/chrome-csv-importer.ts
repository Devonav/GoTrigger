import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Chrome CSV Importer
 * Adapted from Bitwarden's chrome-csv-importer.ts
 *
 * Format: name,url,username,password,note
 * Example: Facebook,https://facebook.com,user@example.com,password123,My notes
 *
 * Special handling for Android app URLs (android://...)
 */
export class ChromeCsvImporter extends BaseImporter {
  readonly formatId = 'chrome-csv';
  readonly formatName = 'Chrome (CSV)';
  readonly formatDescription = 'CSV export from Chrome password manager';

  private androidPatternRegex = new RegExp('^android:\\/\\/.*(?<=@)(.*)(?=\\/)');

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        const url = this.normalizeAndroidUrl(row.url || '');
        let name = row.name || '';

        // Extract app name from Android URL if name is missing
        if (!name && this.androidPatternRegex.test(row.url || '')) {
          const match = row.url.match(this.androidPatternRegex);
          name = match ? match[1] : '';
        }

        const credential: ParsedCredential = {
          url: url,
          username: this.getValueOrDefault(row.username),
          password: this.getValueOrDefault(row.password),
          notes: this.getValueOrDefault(row.note),
          name: this.getValueOrDefault(name, '--')
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Chrome CSV row:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Normalize Android app URLs
   * Converts: android://hash@com.facebook.app/ → androidapp://com.facebook.app
   */
  private normalizeAndroidUrl(url: string): string {
    const match = url?.match(this.androidPatternRegex);
    return match ? `androidapp://${match[1]}` : url;
  }
}
