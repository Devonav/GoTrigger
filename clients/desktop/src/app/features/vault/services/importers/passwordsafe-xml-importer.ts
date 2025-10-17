import { BaseImporter, ParsedCredential } from './base-importer';

/**
 * Password Safe XML Importer
 * Reference: bitwarden-reference/libs/importer/src/importers/passwordsafe-xml-importer.ts
 *
 * Password Safe is an open-source password manager (pwsafe.org)
 * XML Format:
 * <passwordsafe delimiter="\r\n">
 *   <entry>
 *     <group>Work.Projects</group>
 *     <title>GitHub</title>
 *     <username>user@example.com</username>
 *     <password>pass123</password>
 *     <url>https://github.com</url>
 *     <email>email@example.com</email>
 *     <notes>My notes\r\nLine 2</notes>
 *   </entry>
 * </passwordsafe>
 */
export class PasswordSafeXmlImporter extends BaseImporter {
  readonly formatId = 'passwordsafe-xml';
  readonly formatName = 'Password Safe (XML)';
  readonly formatDescription = 'XML export from Password Safe (pwsafe.org)';

  async parse(content: string): Promise<ParsedCredential[]> {
    const credentials: ParsedCredential[] = [];

    try {
      const doc = this.parseXml(content);
      if (!doc) {
        throw new Error('Failed to parse XML');
      }

      const passwordSafe = doc.querySelector('passwordsafe');
      if (!passwordSafe) {
        throw new Error('Missing passwordsafe node');
      }

      // Get notes delimiter (usually \r\n or \n)
      const notesDelimiter = passwordSafe.getAttribute('delimiter') || '\r\n';

      const entries = doc.querySelectorAll('passwordsafe > entry');
      for (const entry of Array.from(entries)) {
        try {
          const credential = this.parseEntry(entry, notesDelimiter);
          if (credential) {
            credentials.push(credential);
          }
        } catch (error) {
          console.warn('Error parsing Password Safe entry:', error);
          continue;
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to parse Password Safe XML:', error);
      throw new Error(error instanceof Error ? error.message : 'Invalid Password Safe XML format');
    }
  }

  private parseEntry(entryNode: Element, notesDelimiter: string): ParsedCredential | null {
    // Extract fields
    const group = this.querySelectorDirectChild(entryNode, 'group');
    const title = this.querySelectorDirectChild(entryNode, 'title');
    const username = this.querySelectorDirectChild(entryNode, 'username');
    const email = this.querySelectorDirectChild(entryNode, 'email');
    const password = this.querySelectorDirectChild(entryNode, 'password');
    const url = this.querySelectorDirectChild(entryNode, 'url');
    const notesEl = this.querySelectorDirectChild(entryNode, 'notes');

    const titleText = this.getXmlText(title) || 'Unnamed';
    let usernameText = this.getXmlText(username);
    const emailText = this.getXmlText(email);
    const passwordText = this.getXmlText(password);
    const urlText = this.getXmlText(url);
    let notesText = this.getXmlText(notesEl);

    // Parse folder (group format: "Work.Projects" => "Work/Projects")
    let folder = '';
    if (group) {
      const groupText = this.getXmlText(group);
      if (groupText) {
        folder = groupText.split('.').join('/');
      }
    }

    // Replace delimiter in notes with newlines
    if (notesText && notesDelimiter) {
      notesText = notesText.split(notesDelimiter).join('\n');
    }

    // Use email as username if username is empty
    if (!usernameText && emailText) {
      usernameText = emailText;
    } else if (emailText) {
      // Add email to notes if different from username
      notesText = notesText ? `${notesText}\nEmail: ${emailText}` : `Email: ${emailText}`;
    }

    // Add folder to notes
    if (folder) {
      notesText = notesText ? `${notesText}\nFolder: ${folder}` : `Folder: ${folder}`;
    }

    return {
      url: urlText || 'note://' + titleText,
      username: usernameText || 'Entry',
      password: passwordText || '',
      notes: notesText || undefined,
      name: titleText,
      folder: folder || undefined
    };
  }
}
