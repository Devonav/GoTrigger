import { BaseImporter, ParsedCredential } from './base-importer';

// Test implementation of BaseImporter
class TestImporter extends BaseImporter {
  readonly formatId = 'test-csv';
  readonly formatName = 'Test (CSV)';
  readonly formatDescription = 'Test importer for unit tests';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    return rows.map((row: any) => ({
      url: row.url || '',
      username: row.username || '',
      password: row.password || '',
      notes: row.notes,
      name: row.name
    }));
  }
}

describe('BaseImporter', () => {
  let importer: TestImporter;

  beforeEach(() => {
    importer = new TestImporter();
  });

  describe('CSV Parsing', () => {
    it('should parse basic CSV with headers', async () => {
      const csv = `url,username,password,name
https://example.com,user@example.com,pass123,Example`;

      const result = await importer.parse(csv);

      expect(result.length).toBe(1);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].username).toBe('user@example.com');
      expect(result[0].password).toBe('pass123');
      expect(result[0].name).toBe('Example');
    });

    it('should handle CSV with no header', () => {
      const csv = `https://example.com,user@example.com,pass123`;
      const rows = (importer as any).parseCsv(csv, false);

      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('https://example.com');
      expect(rows[0][1]).toBe('user@example.com');
      expect(rows[0][2]).toBe('pass123');
    });

    it('should skip empty lines', () => {
      const csv = `url,username,password

https://example.com,user@example.com,pass123

https://test.com,test@test.com,test456`;

      const rows = (importer as any).parseCsv(csv, true);
      expect(rows.length).toBe(2);
    });

    it('should sanitize CSV injection attempts', () => {
      const value1 = (importer as any).sanitizeValue('=cmd|/c calc');
      const value2 = (importer as any).sanitizeValue('@SUM(1+1)');
      const value3 = (importer as any).sanitizeValue('+2+5');
      const value4 = (importer as any).sanitizeValue('-2+5');

      expect(value1).toBe('cmd|/c calc');
      expect(value2).toBe('SUM(1+1)');
      expect(value3).toBe('2+5');
      expect(value4).toBe('2+5');
    });

    it('should handle quoted values with commas', () => {
      const csv = `url,username,password,notes
https://example.com,user@example.com,pass123,"Notes with, comma"`;

      const rows = (importer as any).parseCsv(csv, true);
      expect(rows[0].notes).toBe('Notes with, comma');
    });
  });

  describe('XML Parsing', () => {
    it('should parse valid XML', () => {
      const xml = `<?xml version="1.0"?>
<root>
  <entry>
    <title>Test</title>
    <username>user@example.com</username>
    <password>pass123</password>
  </entry>
</root>`;

      const doc = (importer as any).parseXml(xml);
      expect(doc).not.toBeNull();
      expect(doc.querySelector('root')).not.toBeNull();
    });

    it('should detect XML parsing errors', () => {
      const invalidXml = `<root><entry>Invalid XML</root>`;
      const doc = (importer as any).parseXml(invalidXml);
      // Parser might return doc with error node or null
      expect(doc === null || doc.querySelector('parsererror')).toBeTruthy();
    });

    it('should query direct children only', () => {
      const xml = `<?xml version="1.0"?>
<root>
  <group>
    <entry><title>Child</title></entry>
  </group>
  <entry><title>Direct</title></entry>
</root>`;

      const doc = (importer as any).parseXml(xml);
      const root = doc.querySelector('root');
      const directChildren = (importer as any).querySelectorAllDirectChild(root, 'entry');

      expect(directChildren.length).toBe(1);
      expect((importer as any).getXmlText(directChildren[0].querySelector('title'))).toBe('Direct');
    });

    it('should get XML text content', () => {
      const xml = `<?xml version="1.0"?>
<root>
  <field>  Some Text  </field>
</root>`;

      const doc = (importer as any).parseXml(xml);
      const field = doc.querySelector('field');
      const text = (importer as any).getXmlText(field);

      expect(text).toBe('Some Text');
    });

    it('should get XML attributes', () => {
      const xml = `<?xml version="1.0"?>
<root>
  <entry id="123" name="Test Entry"/>
</root>`;

      const doc = (importer as any).parseXml(xml);
      const entry = doc.querySelector('entry');

      expect((importer as any).getXmlAttribute(entry, 'id')).toBe('123');
      expect((importer as any).getXmlAttribute(entry, 'name')).toBe('Test Entry');
      expect((importer as any).getXmlAttribute(entry, 'missing')).toBe('');
    });
  });

  describe('Utility Methods', () => {
    it('should validate credentials correctly', () => {
      const validCred: ParsedCredential = {
        url: 'https://example.com',
        username: 'user',
        password: 'pass'
      };

      const invalidCred1: ParsedCredential = {
        url: '',
        username: 'user',
        password: 'pass'
      };

      const invalidCred2: ParsedCredential = {
        url: 'https://example.com',
        username: '',
        password: 'pass'
      };

      expect((importer as any).isValidCredential(validCred)).toBe(true);
      expect((importer as any).isValidCredential(invalidCred1)).toBe(false);
      expect((importer as any).isValidCredential(invalidCred2)).toBe(false);
    });

    it('should get value or default', () => {
      expect((importer as any).getValueOrDefault('value')).toBe('value');
      expect((importer as any).getValueOrDefault(null, 'default')).toBe('default');
      expect((importer as any).getValueOrDefault('', 'default')).toBe('default');
      expect((importer as any).getValueOrDefault(undefined, 'default')).toBe('default');
    });

    it('should check null or whitespace', () => {
      expect((importer as any).isNullOrWhitespace(null)).toBe(true);
      expect((importer as any).isNullOrWhitespace(undefined)).toBe(true);
      expect((importer as any).isNullOrWhitespace('')).toBe(true);
      expect((importer as any).isNullOrWhitespace('   ')).toBe(true);
      expect((importer as any).isNullOrWhitespace('value')).toBe(false);
    });

    it('should extract domain from URL', () => {
      expect((importer as any).extractDomain('https://example.com/path')).toBe('example.com');
      expect((importer as any).extractDomain('http://www.example.com')).toBe('www.example.com');
      expect((importer as any).extractDomain('example.com')).toBe('example.com');
    });

    it('should decode HTML entities', () => {
      const text = 'Test &lt;script&gt; &amp; &quot;quotes&quot;';
      const decoded = (importer as any).decodeHtmlEntities(text);
      expect(decoded).toBe('Test <script> & "quotes"');
    });

    it('should parse full name', () => {
      const name1 = (importer as any).parseFullName('John Doe');
      expect(name1.firstName).toBe('John');
      expect(name1.lastName).toBe('Doe');
      expect(name1.middleName).toBe('');

      const name2 = (importer as any).parseFullName('John Middle Doe');
      expect(name2.firstName).toBe('John');
      expect(name2.middleName).toBe('Middle');
      expect(name2.lastName).toBe('Doe');

      const name3 = (importer as any).parseFullName('John');
      expect(name3.firstName).toBe('John');
      expect(name3.middleName).toBe('');
      expect(name3.lastName).toBe('');
    });

    it('should process key-value pairs', () => {
      const cred: ParsedCredential = {
        url: 'https://example.com',
        username: 'user',
        password: 'pass'
      };

      (importer as any).processKvp(cred, 'CustomField', 'CustomValue');
      expect(cred.notes).toBe('CustomField: CustomValue');

      (importer as any).processKvp(cred, 'AnotherField', 'AnotherValue');
      expect(cred.notes).toBe('CustomField: CustomValue\nAnotherField: AnotherValue');
    });
  });
});
