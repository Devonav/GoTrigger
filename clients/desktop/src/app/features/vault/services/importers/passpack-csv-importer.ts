import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Passpack CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/passpack-csv-importer.ts
 * CSV Format: title,url,username,email,password,notes,Tags (JSON format)
 */
export class PasspackCsvImporter extends BaseImporter {
  readonly formatId = 'passpack-csv';
  readonly formatName = 'Passpack (CSV)';
  readonly formatDescription = 'CSV export from Passpack password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Extract tags if present (JSON format)
        let tags = '';
        if (row.Tags) {
          try {
            const tagsJson = JSON.parse(row.Tags);
            if (tagsJson.tags && Array.isArray(tagsJson.tags)) {
              const tagNames = tagsJson.tags
                .map((t: string) => {
                  try {
                    const parsed = JSON.parse(t);
                    return parsed.tag;
                  } catch {
                    return null;
                  }
                })
                .filter((t: string | null) => t);
              tags = tagNames.join(', ');
            }
          } catch {
            // Ignore tag parsing errors
          }
        }

        // Username can be in either username or email field
        const username = row.username || row.email || '';

        let notes = row.notes || '';
        if (tags) {
          notes += (notes ? '\n' : '') + `Tags: ${tags}`;
        }

        const credential: ParsedCredential = {
          url: row.url || '',
          username,
          password: row.password || '',
          notes: notes || undefined,
          name: row.title || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Passpack CSV row:', error);
        continue;
      }
    }

    return credentials;
  }
}
