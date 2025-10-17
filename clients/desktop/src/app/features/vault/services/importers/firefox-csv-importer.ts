import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Firefox CSV Importer
 * Very popular browser with built-in password manager
 *
 * Format: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
 * Firefox 116+ supports importing CSV files
 */
export class FirefoxCsvImporter extends BaseImporter {
  readonly formatId = 'firefox-csv';
  readonly formatName = 'Firefox (CSV)';
  readonly formatDescription = 'CSV export from Firefox password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Firefox columns: url, username, password, httpRealm, formActionOrigin, guid, timeCreated, timeLastUsed, timePasswordChanged
        const url = row.url || '';
        const username = row.username || '';
        const password = row.password || '';

        // Optional metadata (we'll ignore most of it)
        const httpRealm = row.httprealm || '';
        const timeCreated = row.timecreated || '';
        const timeLastUsed = row.timelastused || '';

        // Build notes from metadata if available
        let notes = '';
        if (httpRealm) {
          notes += `HTTP Realm: ${httpRealm}`;
        }

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined
        };

        credentials.push(credential);
      } catch (error) {
        console.warn('Error parsing Firefox row:', error);
        continue;
      }
    }

    return credentials;
  }
}
