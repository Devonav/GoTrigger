import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Sticky Password XML Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/stickypassword-xml-importer.ts
 *
 * Sticky Password is a Windows password manager
 * XML Format:
 * <root>
 *   <Database>
 *     <Logins>
 *       <Login ID="1" Name="user@example.com" Password="pass123"/>
 *     </Logins>
 *     <Accounts>
 *       <Account Name="GitHub" Link="https://github.com" ParentID="G1" Comments="Notes">
 *         <LoginLinks><Login SourceLoginID="1"/></LoginLinks>
 *       </Account>
 *     </Accounts>
 *     <Groups>
 *       <Group ID="G1" Name="Work" ParentID=""/>
 *     </Groups>
 *   </Database>
 * </root>
 */
export class StickyPasswordXmlImporter extends BaseImporter {
  readonly formatId = 'stickypassword-xml';
  readonly formatName = 'Sticky Password (XML)';
  readonly formatDescription = 'XML export from Sticky Password';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      const loginNodes = doc.querySelectorAll('root > Database > Logins > Login');

      for (const loginNode of Array.from(loginNodes)) {
        try {
          const accountId = loginNode.getAttribute('ID');
          if (!accountId) continue;

          const usernameText = loginNode.getAttribute('Name') || '';
          const passwordText = loginNode.getAttribute('Password') || '';

          // Find the account that links to this login
          const accountLogin = doc.querySelector(
            `root > Database > Accounts > Account > LoginLinks > Login[SourceLoginID="${accountId}"]`
          );

          let titleText = '';
          let linkText = '';
          let notesText = '';
          let groupId = '';

          if (accountLogin) {
            const account = accountLogin.parentElement?.parentElement as Element;
            if (account) {
              titleText = account.getAttribute('Name') || '';
              linkText = account.getAttribute('Link') || '';
              groupId = account.getAttribute('ParentID') || '';
              notesText = account.getAttribute('Comments') || '';

              // Replace /n with actual newlines
              if (notesText) {
                notesText = notesText.split('/n').join('\n');
              }
            }
          }

          // Build folder path from group hierarchy
          let folder = '';
          if (groupId) {
            folder = this.buildGroupPath(doc, groupId);
          }

          // Add folder to notes
          if (folder) {
            notesText = notesText ? `${notesText}\nFolder: ${folder}` : `Folder: ${folder}`;
          }

          const credential: ParsedCredential = {
            url: linkText || 'note://' + (titleText || 'Entry'),
            username: usernameText || 'Entry',
            password: passwordText || '',
            notes: notesText || undefined,
            name: titleText || undefined,
            folder: folder || undefined
          };

          credentials.push(credential);
        } catch (error) {
          console.warn('Error parsing Sticky Password login:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Sticky Password XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid Sticky Password XML format');
    }
  }

  private buildGroupPath(doc: Document, groupId: string, path: string = ''): string {
    if (!groupId) return path;

    const group = doc.querySelector(`root > Database > Groups > Group[ID="${groupId}"]`);
    if (!group) return path;

    const groupName = group.getAttribute('Name') || '';
    const parentId = group.getAttribute('ParentID') || '';

    const newPath = path ? `${groupName}/${path}` : groupName;

    if (parentId) {
      return this.buildGroupPath(doc, parentId, newPath);
    }

    return newPath;
  }
}
