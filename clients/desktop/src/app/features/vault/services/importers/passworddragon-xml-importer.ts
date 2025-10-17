import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Password Dragon XML Importer
 * Simplified importer for Password Dragon password manager
 *
 * Note: Password Dragon is discontinued but some users may have old exports
 */
export class PasswordDragonXmlImporter extends BaseImporter {
  readonly formatId = 'passworddragon-xml';
  readonly formatName = 'Password Dragon (XML)';
  readonly formatDescription = 'XML export from Password Dragon (discontinued)';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      // Password Dragon stores entries in <record> elements
      const records = doc.querySelectorAll('record');

      for (const record of Array.from(records)) {
        try {
          const name = this.getXmlAttribute(record, 'name') || 'Unnamed';
          const username = this.getXmlAttribute(record, 'user') || this.getXmlAttribute(record, 'username') || '';
          const password = this.getXmlAttribute(record, 'password') || '';
          const url = this.getXmlAttribute(record, 'url') || this.getXmlAttribute(record, 'website') || '';
          const notes = this.getXmlAttribute(record, 'notes') || this.getXmlAttribute(record, 'comment') || '';
          const category = this.getXmlAttribute(record, 'category') || '';

          let folder = category;
          let finalNotes = notes;

          if (folder) {
            finalNotes = finalNotes ? `${finalNotes}\nFolder: ${folder}` : `Folder: ${folder}`;
          }

          const credential: ParsedCredential = {
            url: url || 'note://' + name,
            username: username || 'Entry',
            password: password || '',
            notes: finalNotes || undefined,
            name: name,
            folder: folder || undefined
          };

          credentials.push(credential);
        } catch (error) {
          console.warn('Error parsing Password Dragon record:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Password Dragon XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid Password Dragon XML format');
    }
  }
}
