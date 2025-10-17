import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * SafeInCloud XML Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/safeincloud-xml-importer.ts
 *
 * SafeInCloud is a popular cross-platform password manager
 * XML Format:
 * <database>
 *   <label id="1" name="Work"/>
 *   <card type="login" title="GitHub" star="true" deleted="false">
 *     <label_id>1</label_id>
 *     <field name="Login" type="login">user@example.com</field>
 *     <field name="Password" type="password">pass123</field>
 *     <field name="Website" type="link">https://github.com</field>
 *     <notes>My notes</notes>
 *   </card>
 * </database>
 */
export class SafeInCloudXmlImporter extends BaseImporter {
  readonly formatId = 'safeincloud-xml';
  readonly formatName = 'SafeInCloud (XML)';
  readonly formatDescription = 'XML export from SafeInCloud password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      const database = doc.querySelector('database');
      if (!database) {
        throw new Error('Missing database node');
      }

      // Build folder/label map (id -> name)
      const foldersMap = new Map<string, string>();
      const labels = doc.querySelectorAll('database > label');
      for (const label of Array.from(labels)) {
        const id = label.getAttribute('id');
        const name = label.getAttribute('name');
        if (id && name) {
          foldersMap.set(id, name);
        }
      }

      // Parse cards/entries
      const cards = doc.querySelectorAll('database > card');
      for (const card of Array.from(cards)) {
        try {
          // Skip templates and deleted items
          if (card.getAttribute('template') === 'true' || card.getAttribute('deleted') === 'true') {
            continue;
          }

          const credential = this.parseCard(card, foldersMap);
          if (credential) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing SafeInCloud card:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse SafeInCloud XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid SafeInCloud XML format');
    }
  }

  private parseCard(cardNode: Element, foldersMap: Map<string, string>): ParsedCredential | null {
    const title = cardNode.getAttribute('title') || 'Unnamed';
    const cardType = cardNode.getAttribute('type') || 'login';
    const starred = cardNode.getAttribute('star') === 'true';

    // Get folder
    let folder = '';
    const labelIdEl = this.querySelectorDirectChild(cardNode, 'label_id');
    if (labelIdEl) {
      const labelId = this.getXmlText(labelIdEl);
      if (labelId && foldersMap.has(labelId)) {
        folder = foldersMap.get(labelId)!;
      }
    }

    // Get notes
    const notesEl = this.querySelectorDirectChild(cardNode, 'notes');
    let notes = this.getXmlText(notesEl);

    // If it's a secure note, convert to note type
    if (cardType === 'note') {
      if (folder) {
        notes = notes ? `${notes}\nFolder: ${folder}` : `Folder: ${folder}`;
      }
      if (starred) {
        notes = notes ? `${notes}\nFavorite: Yes` : 'Favorite: Yes';
      }

      return {
        url: 'note://' + title,
        username: 'Secure Note',
        password: '',
        notes: notes || undefined,
        name: title,
        folder: folder || undefined
      };
    }

    // Parse fields for login cards
    let username = '';
    let password = '';
    let url = '';
    const customFields: string[] = [];

    const fields = this.querySelectorAllDirectChild(cardNode, 'field');
    for (const field of fields) {
      const fieldName = field.getAttribute('name') || '';
      const fieldType = field.getAttribute('type')?.toLowerCase() || '';
      const fieldValue = this.getXmlText(field);

      if (!fieldValue) continue;

      if (fieldType === 'login') {
        username = fieldValue;
      } else if (fieldType === 'password' || fieldType === 'secret') {
        if (!password) {
          password = fieldValue;
        } else {
          // Multiple passwords - add as custom field
          customFields.push(`${fieldName}: ${fieldValue}`);
        }
      } else if (fieldType === 'link' || fieldType === 'url') {
        if (!url) {
          url = fieldValue;
        } else {
          // Multiple URLs - add to notes
          notes = notes ? `${notes}\n${fieldName}: ${fieldValue}` : `${fieldName}: ${fieldValue}`;
        }
      } else if (fieldType === 'email') {
        // Add email to notes
        notes = notes ? `${notes}\nEmail: ${fieldValue}` : `Email: ${fieldValue}`;
      } else {
        // Other custom fields
        customFields.push(`${fieldName}: ${fieldValue}`);
      }
    }

    // Add custom fields to notes
    if (customFields.length > 0) {
      notes = notes ? `${notes}\n\nCustom Fields:\n${customFields.join('\n')}` : `Custom Fields:\n${customFields.join('\n')}`;
    }

    // Add folder to notes
    if (folder) {
      notes = notes ? `${notes}\nFolder: ${folder}` : `Folder: ${folder}`;
    }

    // Add favorite status
    if (starred) {
      notes = notes ? `${notes}\nFavorite: Yes` : 'Favorite: Yes';
    }

    return {
      url: url || 'note://' + title,
      username: username || 'Entry',
      password: password || '',
      notes: notes || undefined,
      name: title,
      folder: folder || undefined
    };
  }
}
