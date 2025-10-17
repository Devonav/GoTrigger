import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Kaspersky Password Manager TXT Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/kaspersky-txt-importer.ts
 *
 * TXT Format:
 * Websites
 *
 * Website name: GitHub
 * Website URL: https://github.com
 * Login: user@example.com
 * Password: pass123
 * Comment: My notes
 *
 * ---
 *
 * (next entry)
 */
export class KasperskyTxtImporter extends BaseImporter {
  readonly formatId = 'kaspersky-txt';
  readonly formatName = 'Kaspersky Password Manager (TXT)';
  readonly formatDescription = 'TXT export from Kaspersky Password Manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    // Split by entry delimiter
    const entries = content.split(/\n---\n/);

    for (const entry of entries) {
      try {
        // Parse key-value pairs
        const data = this.parseEntry(entry);

        // Skip if no login data
        if (!data.has('Login') && !data.has('Password')) {
          continue;
        }

        const name = data.get('Website name') || data.get('Application') || '';
        const url = data.get('Website URL') || '';
        const username = data.get('Login') || data.get('Login name') || '';
        const password = data.get('Password') || '';
        const notes = data.get('Comment') || data.get('Text') || '';

        const credential: ParsedCredential = {
          url: url || name, // Use name as fallback for apps
          username,
          password,
          notes: notes || undefined,
          name: name || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Kaspersky TXT entry:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Parse a single entry into key-value map
   * Format: "Key: Value" per line
   */
  private parseEntry(entry: string): Map<string, string> {
    const data = new Map<string, string>();
    const lines = entry.split(/\r?\n/);

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          data.set(key, value);
        }
      }
    }

    return data;
  }
}
