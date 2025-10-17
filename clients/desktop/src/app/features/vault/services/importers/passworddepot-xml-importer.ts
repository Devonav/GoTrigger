import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Password Depot 17 XML Importer
 * Password Depot is a commercial Windows password manager
 */
export class PasswordDepotXmlImporter extends BaseImporter {
  readonly formatId = 'passworddepot-xml';
  readonly formatName = 'Password Depot (XML)';
  readonly formatDescription = 'XML export from Password Depot 17+';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      // Password Depot uses <entry> or <item> elements
      const entries = doc.querySelectorAll('entry, item');

      for (const entry of Array.from(entries)) {
        try {
          // Try to extract common fields
          const title = this.getFieldValue(entry, ['title', 'name', 'description']);
          const username = this.getFieldValue(entry, ['username', 'user', 'login']);
          const password = this.getFieldValue(entry, ['password', 'pwd', 'pass']);
          const url = this.getFieldValue(entry, ['url', 'website', 'link']);
          const notes = this.getFieldValue(entry, ['notes', 'comment', 'remarks']);
          const category = this.getFieldValue(entry, ['category', 'group', 'folder']);

          let folder = category;
          let finalNotes = notes;

          if (folder) {
            finalNotes = finalNotes ? `${finalNotes}\nFolder: ${folder}` : `Folder: ${folder}`;
          }

          const credential: ParsedCredential = {
            url: url || 'note://' + (title || 'Entry'),
            username: username || 'Entry',
            password: password || '',
            notes: finalNotes || undefined,
            name: title || undefined,
            folder: folder || undefined
          };

          credentials.push(credential);
        } catch (error) {
          console.warn('Error parsing Password Depot entry:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Password Depot XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid Password Depot XML format');
    }
  }

  private getFieldValue(entry: Element, fieldNames: string[]): string {
    // Try as attributes first
    for (const name of fieldNames) {
      const value = entry.getAttribute(name);
      if (value) return value;
    }

    // Try as child elements
    for (const name of fieldNames) {
      const child = this.querySelectorDirectChild(entry, name);
      if (child) {
        const value = this.getXmlText(child);
        if (value) return value;
      }
    }

    return '';
  }
}
