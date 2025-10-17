import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * KeePass2 XML Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/keepass2-xml-importer.ts
 *
 * KeePass is one of the most popular open-source password managers
 * XML Format:
 * <KeePassFile>
 *   <Root>
 *     <Group>
 *       <Name>Root</Name>
 *       <Entry>
 *         <String><Key>Title</Key><Value>GitHub</Value></String>
 *         <String><Key>UserName</Key><Value>user@example.com</Value></String>
 *         <String><Key>Password</Key><Value>pass123</Value></String>
 *         <String><Key>URL</Key><Value>https://github.com</Value></String>
 *         <String><Key>Notes</Key><Value>My notes</Value></String>
 *       </Entry>
 *       <Group>
 *         <Name>Work</Name>
 *         ...
 *       </Group>
 *     </Group>
 *   </Root>
 * </KeePassFile>
 */
export class KeePass2XmlImporter extends BaseImporter {
  readonly formatId = 'keepass2-xml';
  readonly formatName = 'KeePass2 (XML)';
  readonly formatDescription = 'XML export from KeePass2 password manager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      // Validate structure: KeePassFile > Root > Group
      const keepassFile = doc.querySelector('KeePassFile');
      if (!keepassFile) {
        throw new Error('Missing KeePassFile node');
      }

      const root = this.querySelectorDirectChild(keepassFile, 'Root');
      if (!root) {
        throw new Error('Missing Root node');
      }

      const rootGroup = this.querySelectorDirectChild(root, 'Group');
      if (!rootGroup) {
        throw new Error('Missing root Group node');
      }

      // Traverse the group tree recursively
      this.traverseGroup(rootGroup, '', credentials, true);

      return credentials;
    } catch (error) {
      console.error('Failed to parse KeePass2 XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid KeePass2 XML format');
    }
  }

  private traverseGroup(
    groupNode: Element,
    parentPath: string,
    credentials: ParsedCredential[],
    isRoot: boolean = false
  ): void {
    // Get group name (skip for root)
    let groupPath = parentPath;
    if (!isRoot) {
      const nameEl = this.querySelectorDirectChild(groupNode, 'Name');
      const groupName = this.getXmlText(nameEl) || 'Unnamed';
      groupPath = parentPath ? `${parentPath}/${groupName}` : groupName;
    }

    // Process entries in this group
    const entries = this.querySelectorAllDirectChild(groupNode, 'Entry');
    for (const entry of entries) {
      try {
        const credential = this.parseEntry(entry, groupPath);
        if (credential) {
          credentials.push(credential);
        }
      } catch (error) {
        console.warn('Error parsing KeePass2 entry:', error);
        continue;
      }
    }

    // Recursively process child groups
    const childGroups = this.querySelectorAllDirectChild(groupNode, 'Group');
    for (const childGroup of childGroups) {
      this.traverseGroup(childGroup, groupPath, credentials, false);
    }
  }

  private parseEntry(entryNode: Element, folder: string): ParsedCredential | null {
    const fields = new Map<string, string>();

    // Parse all String elements (key-value pairs)
    const strings = this.querySelectorAllDirectChild(entryNode, 'String');
    for (const stringNode of strings) {
      const keyEl = this.querySelectorDirectChild(stringNode, 'Key');
      const valueEl = this.querySelectorDirectChild(stringNode, 'Value');

      if (!keyEl || !valueEl) continue;

      const key = this.getXmlText(keyEl);
      const value = this.getXmlText(valueEl);

      if (key && value) {
        fields.set(key, value);
      }
    }

    // Extract standard fields
    const title = fields.get('Title') || '';
    const username = fields.get('UserName') || '';
    const password = fields.get('Password') || '';
    const url = fields.get('URL') || '';
    let notes = fields.get('Notes') || '';

    // Extract TOTP (stored as 'otp' field)
    let totp = '';
    if (fields.has('otp')) {
      totp = fields.get('otp')!;
      // Remove 'key=' prefix if present
      totp = totp.replace(/^key=/i, '');
    }

    // Process custom fields (anything not standard)
    const standardFields = ['Title', 'UserName', 'Password', 'URL', 'Notes', 'otp'];
    const customFields: string[] = [];

    for (const [key, value] of fields.entries()) {
      if (!standardFields.includes(key)) {
        customFields.push(`${key}: ${value}`);
      }
    }

    if (customFields.length > 0) {
      notes += (notes ? '\n\n' : '') + 'Custom Fields:\n' + customFields.join('\n');
    }

    // Add folder to notes
    if (folder) {
      notes += (notes ? '\n' : '') + `Folder: ${folder}`;
    }

    const credential: ParsedCredential = {
      url: url || 'note://' + title,
      username: username || 'Entry',
      password: password || '',
      notes: notes || undefined,
      name: title || undefined,
      folder: folder || undefined,
      totp: totp || undefined
    };

    return credential;
  }
}
