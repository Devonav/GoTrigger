import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * True Key CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/truekey-csv-importer.ts
 * CSV Format: name,url,login,password,memo,kind,favorite
 */
export class TrueKeyCsvImporter extends BaseImporter {
  readonly formatId = 'truekey-csv';
  readonly formatName = 'True Key (CSV)';
  readonly formatDescription = 'CSV export from True Key password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Only import login items (skip cards, notes)
        const kind = row.kind || 'login';
        if (kind !== 'login') {
          continue;
        }

        let notes = row.memo || '';
        if (row.favorite === 'true') {
          notes += (notes ? '\n' : '') + 'Favorite: Yes';
        }

        const credential: ParsedCredential = {
          url: row.url || '',
          username: row.login || '',
          password: row.password || '',
          notes: notes || undefined,
          name: row.name || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing True Key CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
