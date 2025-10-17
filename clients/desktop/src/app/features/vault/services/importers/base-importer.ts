import Papa from 'papaparse';

export interface ParsedCredential {
  url: string;
  username: string;
  password: string;
  notes?: string;
  name?: string;
  folder?: string;
  totp?: string;
}

/**
 * Base Importer - Abstract class for all password manager importers
 * Following Bitwarden's architecture pattern
 */
export abstract class BaseImporter {
  abstract readonly formatId: string;
  abstract readonly formatName: string;
  abstract readonly formatDescription: string;

  /**
   * Parse import file content and return credentials
   */
  abstract parse(content: string): Promise<ParsedCredential[]>;

  /**
   * Parse CSV using Papa Parse (same as Bitwarden)
   * Handles CSV complexity, encoding, malformed data
   */
  protected parseCsv(data: string, header: boolean = true): any[] {
    try {
      const parseResult = Papa.parse(data, {
        header: header,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(),
        transform: (value: string) => this.sanitizeValue(value)
      });

      // Log parse errors (like Bitwarden)
      if (parseResult.errors && parseResult.errors.length > 0) {
        parseResult.errors.forEach((e: any) => {
          if (e.row != null) {
            console.warn(`CSV parse warning at row ${e.row}: ${e.message}`);
          }
        });
      }

      return parseResult.data || [];
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      return [];
    }
  }

  /**
   * Sanitize CSV value to prevent CSV injection
   * Removes leading formula characters: = @ + - \t \r
   */
  protected sanitizeValue(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Remove leading formula characters (CSV injection prevention)
    const sanitized = value.replace(/^[=@+\-\t\r]/, '');

    return sanitized.trim();
  }

  /**
   * Decode HTML entities (for LastPass exports)
   * Example: &lt; → <, &gt; → >, &amp; → &
   */
  protected decodeHtmlEntities(text: string): string {
    const entities: { [key: string]: string } = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };

    return text.replace(/&[a-z0-9]+;/gi, (match) => entities[match.toLowerCase()] || match);
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    if (!url) return '';

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      // If URL parsing fails, clean up manually
      return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }
  }

  /**
   * Validate credential has required fields
   */
  protected isValidCredential(cred: ParsedCredential): boolean {
    return !!(cred.url && cred.username && cred.password);
  }

  /**
   * Common username field names (for smart field detection)
   */
  protected usernameFieldNames = [
    'username', 'user', 'login', 'email', 'e-mail', 'userid', 'user id',
    'account', 'member', 'id'
  ];

  /**
   * Common password field names (for smart field detection)
   */
  protected passwordFieldNames = [
    'password', 'pass', 'pwd', 'pw', 'passwd', 'passphrase', 'pin', 'code', 'secret'
  ];

  /**
   * Common URI/URL field names (for smart field detection)
   */
  protected uriFieldNames = [
    'url', 'uri', 'website', 'site', 'link', 'href', 'web', 'host', 'hostname'
  ];

  // ========== Bitwarden Compatibility Helpers ==========
  // These methods make it easy to port Bitwarden's importers

  /**
   * Get value or return default (Bitwarden pattern)
   */
  protected getValueOrDefault(value: string | null | undefined, defaultValue: string = ''): string {
    return value != null && value !== '' ? value : defaultValue;
  }

  /**
   * Process key-value pair into notes
   * Used by many Bitwarden importers for custom fields
   */
  protected processKvp(cred: ParsedCredential, key: string, value: string): void {
    if (!key || !value) return;

    const note = `${key}: ${value}`;
    cred.notes = cred.notes ? `${cred.notes}\n${note}` : note;
  }

  /**
   * Parse full name into components
   * Returns { firstName, middleName, lastName }
   */
  protected parseFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
      return { firstName: parts[0], middleName: '', lastName: '' };
    } else if (parts.length === 2) {
      return { firstName: parts[0], middleName: '', lastName: parts[1] };
    } else if (parts.length >= 3) {
      return {
        firstName: parts[0],
        middleName: parts.slice(1, -1).join(' '),
        lastName: parts[parts.length - 1]
      };
    }

    return { firstName: '', middleName: '', lastName: '' };
  }

  /**
   * Add multiple notes with section headers
   */
  protected addSection(cred: ParsedCredential, sectionName: string, content: string): void {
    if (!content) return;

    const section = `\n\n=== ${sectionName} ===\n${content}`;
    cred.notes = (cred.notes || '') + section;
  }

  /**
   * Check if string is null or whitespace (Bitwarden pattern)
   */
  protected isNullOrWhitespace(value: string | null | undefined): boolean {
    return value == null || value.trim() === '';
  }

  // ========== XML Parsing Helpers ==========

  /**
   * Parse XML string into a DOM document
   * Used by XML importers (KeePass2, Password Safe, etc.)
   * Uses browser's built-in DOMParser (works in Electron renderer)
   */
  protected parseXml(data: string): Document | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'text/xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.error('XML parsing error:', parserError.textContent);
        return null;
      }

      return doc;
    } catch (error) {
      console.error('Failed to parse XML:', error);
      return null;
    }
  }

  /**
   * Query selector for direct children only
   * Prevents selecting nested elements (Bitwarden pattern)
   */
  protected querySelectorDirectChild(element: Element, selector: string): Element | null {
    const children = Array.from(element.children);
    return children.find(child => child.tagName.toLowerCase() === selector.toLowerCase()) || null;
  }

  /**
   * Query selector all for direct children only
   * Prevents selecting nested elements (Bitwarden pattern)
   */
  protected querySelectorAllDirectChild(element: Element, selector: string): Element[] {
    const children = Array.from(element.children);
    return children.filter(child => child.tagName.toLowerCase() === selector.toLowerCase());
  }

  /**
   * Get text content from XML element
   */
  protected getXmlText(element: Element | null): string {
    if (!element) return '';
    return element.textContent?.trim() || '';
  }

  /**
   * Get attribute value from XML element
   */
  protected getXmlAttribute(element: Element | null, attrName: string): string {
    if (!element) return '';
    return element.getAttribute(attrName) || '';
  }
}
