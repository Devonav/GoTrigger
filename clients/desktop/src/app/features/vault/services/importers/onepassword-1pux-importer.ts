import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * 1Password 1PUX Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/onepassword/onepassword-1pux-importer.ts
 *
 * 1PUX is 1Password's new export format (version 8+)
 * JSON Format:
 * {
 *   "accounts": [{
 *     "vaults": [{
 *       "items": [{
 *         "uuid": "...",
 *         "categoryUuid": "001",
 *         "state": "active" | "archived",
 *         "favIndex": 0 | 1,
 *         "overview": {
 *           "title": "GitHub",
 *           "url": "https://github.com",
 *           "tags": ["Work"]
 *         },
 *         "details": {
 *           "loginFields": [
 *             {"designation": "username", "value": "user@example.com"},
 *             {"designation": "password", "value": "pass123"}
 *           ],
 *           "notesPlain": "My notes",
 *           "sections": [...]
 *         }
 *       }]
 *     }]
 *   }]
 * }
 */
export class OnePassword1PuxImporter extends BaseImporter {
  readonly formatId = 'onepassword-1pux';
  readonly formatName = '1Password (1PUX)';
  readonly formatDescription = 'JSON export from 1Password 8+ (1PUX format)';

  // Category UUIDs from 1Password
  private readonly CATEGORY_LOGIN = '001';
  private readonly CATEGORY_CREDIT_CARD = '002';
  private readonly CATEGORY_SECURE_NOTE = '003';
  private readonly CATEGORY_IDENTITY = '004';
  private readonly CATEGORY_PASSWORD = '005';

  async parse(content: string): Promise<ParsedCredential[]> {
    try {
      const data = JSON.parse(content);

      if (!data.accounts || !Array.isArray(data.accounts) || data.accounts.length === 0) {
        throw new Error('Invalid 1Password 1PUX format');
      }

      const credentials: ParsedCredential[] = [];
      const account = data.accounts[0];

      if (!account.vaults || !Array.isArray(account.vaults)) {
        return credentials;
      }

      for (const vault of account.vaults) {
        if (!vault.items || !Array.isArray(vault.items)) {
          continue;
        }

        for (const item of vault.items) {
          try {
            // Skip archived items
            if (item.state === 'archived') {
              continue;
            }

            const category = item.categoryUuid || '';

            // Only process login, password, and secure note types for now
            if (![this.CATEGORY_LOGIN, this.CATEGORY_PASSWORD, this.CATEGORY_SECURE_NOTE].includes(category)) {
              // Convert cards and identities to secure notes
              if (category === this.CATEGORY_CREDIT_CARD || category === this.CATEGORY_IDENTITY) {
                const credential = this.parseAsSecureNote(item);
                if (credential) {
                  credentials.push(credential);
                }
              }
              continue;
            }

            const credential = this.parseItem(item);
            if (credential) {
              credentials.push(credential);
            }
          } catch (error) {
            console.warn('Error parsing 1Password 1PUX item:', error);
            continue;
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse 1Password 1PUX:', error);
      throw new Error('Invalid JSON format or not a 1Password 1PUX export');
    }
  }

  private parseItem(item: any): ParsedCredential | null {
    const overview = item.overview || {};
    const details = item.details || {};

    // Get basic info
    const name = overview.title || '';
    let url = overview.url || '';
    let notes = details.notesPlain || '';

    // Parse URLs from overview
    if (overview.urls && Array.isArray(overview.urls)) {
      const urls = overview.urls
        .filter((u: any) => u.url)
        .map((u: any) => u.url);
      if (urls.length > 0) {
        url = urls[0];
        if (urls.length > 1) {
          notes += (notes ? '\n\n' : '') + 'Additional URLs:\n' + urls.slice(1).join('\n');
        }
      }
    }

    // Get folder from tags
    let folder = '';
    if (overview.tags && Array.isArray(overview.tags) && overview.tags.length > 0) {
      folder = overview.tags[0];
    }

    // Parse login fields
    let username = '';
    let password = '';
    const customFields: string[] = [];

    if (details.loginFields && Array.isArray(details.loginFields)) {
      for (const field of details.loginFields) {
        if (field.designation === 'username' && field.value) {
          username = field.value;
        } else if (field.designation === 'password' && field.value) {
          password = field.value;
        } else if (field.name && field.value) {
          customFields.push(`${field.name}: ${field.value}`);
        }
      }
    }

    // For password category, get password from details
    if (item.categoryUuid === this.CATEGORY_PASSWORD && details.password) {
      password = details.password;
    }

    // Parse sections for additional fields
    if (details.sections && Array.isArray(details.sections)) {
      for (const section of details.sections) {
        if (!section.fields || !Array.isArray(section.fields)) {
          continue;
        }

        for (const field of section.fields) {
          if (!field.title || !field.value) {
            continue;
          }

          // Extract value (can be in different formats)
          let fieldValue = '';
          if (typeof field.value === 'string') {
            fieldValue = field.value;
          } else if (field.value.string) {
            fieldValue = field.value.string;
          } else if (field.value.concealed) {
            fieldValue = field.value.concealed;
          } else if (field.value.url) {
            fieldValue = field.value.url;
          } else if (field.value.email) {
            fieldValue = field.value.email;
          } else if (field.value.phone) {
            fieldValue = field.value.phone;
          } else if (field.value.date) {
            fieldValue = String(field.value.date);
          }

          if (fieldValue) {
            // Check if it's a standard field
            const fieldTitle = field.title.toLowerCase();
            if (fieldTitle.includes('username') && !username) {
              username = fieldValue;
            } else if (fieldTitle.includes('password') && !password) {
              password = fieldValue;
            } else if (fieldTitle.includes('url') && !url) {
              url = fieldValue;
            } else if (fieldTitle.includes('totp') || fieldTitle.includes('one-time password')) {
              notes += (notes ? '\n' : '') + `TOTP: ${fieldValue}`;
            } else {
              customFields.push(`${field.title}: ${fieldValue}`);
            }
          }
        }
      }
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
    if (item.favIndex === 1) {
      notes += (notes ? '\n' : '') + 'Favorite: Yes';
    }

    const credential: ParsedCredential = {
      url: url || 'note://' + name,
      username: username || 'Secure Note',
      password: password || '',
      notes: notes || undefined,
      name: name || undefined,
      folder: folder || undefined
    };

    return credential;
  }

  private parseAsSecureNote(item: any): ParsedCredential | null {
    const overview = item.overview || {};
    const details = item.details || {};

    const name = overview.title || 'Secure Note';
    let notes = details.notesPlain || '';

    // Extract all fields as notes
    if (details.sections && Array.isArray(details.sections)) {
      const fields: string[] = [];
      for (const section of details.sections) {
        if (section.title) {
          fields.push(`\n=== ${section.title} ===`);
        }

        if (section.fields && Array.isArray(section.fields)) {
          for (const field of section.fields) {
            if (!field.title) continue;

            let fieldValue = '';
            if (typeof field.value === 'string') {
              fieldValue = field.value;
            } else if (field.value?.string) {
              fieldValue = field.value.string;
            } else if (field.value?.concealed) {
              fieldValue = field.value.concealed;
            } else {
              fieldValue = JSON.stringify(field.value);
            }

            if (fieldValue) {
              fields.push(`${field.title}: ${fieldValue}`);
            }
          }
        }
      }

      if (fields.length > 0) {
        notes += (notes ? '\n\n' : '') + fields.join('\n');
      }
    }

    return {
      url: 'note://' + name,
      username: 'Secure Note',
      password: '',
      notes: notes || undefined,
      name: name
    };
  }
}
