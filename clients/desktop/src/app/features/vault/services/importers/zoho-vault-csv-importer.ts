import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Zoho Vault CSV Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/zohovault-csv-importer.ts
 *
 * CSV Columns: "Password Name","Password URL","Folder Name","Notes","Favorite","SecretData","CustomData"
 * Example: GitHub,https://github.com,Work,My notes,1,"username:user@example.com\npassword:pass123\nSecretType:Password",""
 */
export class ZohoVaultCsvImporter extends BaseImporter {
  readonly formatId = 'zoho-csv';
  readonly formatName = 'Zoho Vault (CSV)';
  readonly formatDescription = 'CSV export from Zoho Vault password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      try {
        // Get name (try both column name formats)
        const name = row['Password Name'] || row['Secret Name'] || '';
        if (!name) {
          continue; // Skip if no name
        }

        // Get URL (try both formats)
        const url = row['Password URL'] || row['Secret URL'] || '';
        const folder = row['Folder Name'] || '';
        let notes = row.Notes || '';
        const favorite = row.Favorite === '1';

        // Parse SecretData and CustomData for username/password
        let username = '';
        let password = '';
        const customFields: string[] = [];

        // Parse SecretData (format: "key:value" per line)
        if (row.SecretData) {
          const parsed = this.parseKeyValueData(row.SecretData);
          username = parsed.username || username;
          password = parsed.password || password;
          customFields.push(...parsed.customFields);
        }

        // Parse CustomData (same format)
        if (row.CustomData) {
          const parsed = this.parseKeyValueData(row.CustomData);
          username = parsed.username || username;
          password = parsed.password || password;
          customFields.push(...parsed.customFields);
        }

        // Add custom fields to notes
        if (customFields.length > 0) {
          notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
        }

        // Add folder to notes
        if (folder) {
          notes += (notes ? '\n' : '') + `Folder: ${folder}`;
        }

        // Add favorite status
        if (favorite) {
          notes += (notes ? '\n' : '') + 'Favorite: Yes';
        }

        const credential: ParsedCredential = {
          url,
          username,
          password,
          notes: notes || undefined,
          name,
          folder: folder || undefined
        };

        if (this.isValidCredential(credential)) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing Zoho Vault CSV row:', error);
        continue;
      }
    }

    return credentials;
  }

  /**
   * Parse key:value data (format: "key:value\nkey2:value2")
   * Returns username, password, and custom fields
   */
  private parseKeyValueData(data: string): { username: string; password: string; customFields: string[] } {
    const result = { username: '', password: '', customFields: [] as string[] };

    if (!data) return result;

    const lines = data.split(/\r?\n/);
    for (const line of lines) {
      const colonPos = line.indexOf(':');
      if (colonPos < 0) continue;

      const key = line.substring(0, colonPos).trim().toLowerCase();
      const value = line.substring(colonPos + 1).trim();

      if (!value || key === 'secrettype') {
        continue; // Skip empty values and SecretType field
      }

      // Check if it's a username field (inherited from BaseImporter)
      if (this.usernameFieldNames.includes(key)) {
        result.username = value;
      }
      // Check if it's a password field (inherited from BaseImporter)
      else if (this.passwordFieldNames.includes(key)) {
        result.password = value;
      }
      // Otherwise it's a custom field
      else {
        result.customFields.push(`${key}: ${value}`);
      }
    }

    return result;
  }
}
