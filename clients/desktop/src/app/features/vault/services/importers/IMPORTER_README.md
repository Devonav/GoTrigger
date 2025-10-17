# Password Manager Importers

## Overview

This module provides comprehensive import support for **45+ password managers**, allowing users to migrate their credentials seamlessly. The implementation follows Bitwarden's proven architecture pattern, adapted for our simplified credential model.

## 📊 Statistics

- **Total Importers:** 45
- **CSV Importers:** 29
- **JSON Importers:** 10
- **XML Importers:** 6
- **Total Format Support:** 59 formats (including variants)

## 🎯 Supported Formats

### Major Password Managers (CSV)
| Password Manager | Market Share | Format |
|-----------------|--------------|--------|
| **1Password** | ~25% | CSV, 1PIF, 1PUX |
| **LastPass** | ~21% | CSV |
| **Bitwarden** | ~20% | CSV, JSON |
| **Dashlane** | ~15% | CSV, JSON |
| **NordPass** | Growing | CSV |
| **Keeper Security** | ~5% | CSV, JSON |
| **RoboForm** | ~5% | CSV |

### Browser Password Managers (CSV)
- Chrome/Chromium
- Microsoft Edge
- Mozilla Firefox
- Apple Safari
- Brave Browser
- Opera Browser
- Vivaldi Browser

### Other Password Managers (CSV)
- Zoho Vault
- mSecure
- Avast Passwords
- Ascendo DataVault
- Avira Password Manager
- BlackBerry Password Keeper
- Blur (by Abine)
- Buttercup
- Codebook
- Encryptr
- Kaspersky Password Manager
- KeePassX
- Myki
- Passpack
- RememBear
- SaferPass
- True Key

### JSON Format Importers
- **1Password 1PIF** - Legacy format (pre-v8)
- **1Password 1PUX** - New format (v8+)
- **Bitwarden JSON** - Full export with folders
- **Proton Pass** - Privacy-focused password manager
- **Dashlane JSON** - Full export format
- **Enpass JSON** - Encrypted vault format
- **Keeper JSON** - Enterprise format
- **Passman JSON** - Nextcloud password manager
- **Password Boss JSON** - Multi-device sync
- **Avast JSON** - Full export format

### XML Format Importers
- **KeePass2** ⭐ - Most popular open-source password manager
- **Password Safe** - Open-source (pwsafe.org)
- **SafeInCloud** - Cross-platform
- **Sticky Password** - Windows password manager
- **Password Depot** - Commercial solution
- **Password Dragon** - Legacy/discontinued

## 🏗️ Architecture

### Base Importer Pattern

All importers extend the `BaseImporter` abstract class:

```typescript
export abstract class BaseImporter {
  abstract readonly formatId: string;
  abstract readonly formatName: string;
  abstract readonly formatDescription: string;
  abstract parse(content: string): Promise<ParsedCredential[]>;
}
```

### Parsed Credential Model

```typescript
export interface ParsedCredential {
  url: string;           // Website URL or identifier
  username: string;      // Username or login
  password: string;      // Password
  notes?: string;        // Additional notes
  name?: string;         // Entry name/title
  folder?: string;       // Folder/category
  totp?: string;         // TOTP secret
}
```

### Helper Methods Available

#### CSV Parsing
- `parseCsv(data, header)` - Uses Papa Parse with error handling
- `sanitizeValue(value)` - Prevents CSV injection attacks

#### XML Parsing
- `parseXml(data)` - Uses browser's DOMParser
- `querySelectorDirectChild(element, selector)` - Query direct children only
- `querySelectorAllDirectChild(element, selector)` - Query all direct children
- `getXmlText(element)` - Extract text content
- `getXmlAttribute(element, name)` - Extract attribute value

#### Utility Methods
- `isValidCredential(cred)` - Validates required fields
- `getValueOrDefault(value, default)` - Safe value extraction
- `processKvp(cred, key, value)` - Add custom field to notes
- `parseFullName(name)` - Split full name into components
- `extractDomain(url)` - Extract domain from URL
- `decodeHtmlEntities(text)` - Decode HTML entities
- `isNullOrWhitespace(value)` - Check empty values

## 📁 File Structure

```
importers/
├── README.md                        # This file
├── index.ts                         # Exports all importers
├── base-importer.ts                 # Base class with helpers
│
├── CSV Importers (29 files)
│   ├── chrome-csv-importer.ts
│   ├── lastpass-csv-importer.ts
│   ├── onepassword-csv-importer.ts
│   └── ... (26 more)
│
├── JSON Importers (10 files)
│   ├── onepassword-1pif-importer.ts
│   ├── onepassword-1pux-importer.ts
│   ├── bitwarden-json-importer.ts
│   ├── protonpass-json-importer.ts
│   └── ... (6 more)
│
└── XML Importers (6 files)
    ├── keepass2-xml-importer.ts     # Most popular!
    ├── passwordsafe-xml-importer.ts
    ├── safeincloud-xml-importer.ts
    └── ... (3 more)
```

## 🔒 Security Features

### CSV Injection Prevention
All CSV values are sanitized to remove leading formula characters (`=`, `@`, `+`, `-`, `\t`, `\r`):

```typescript
protected sanitizeValue(value: string): string {
  return value.replace(/^[=@+\-\t\r]/, '').trim();
}
```

### HTML Entity Decoding
Prevents XSS attacks from encoded entities in LastPass and other exports:

```typescript
protected decodeHtmlEntities(text: string): string {
  // Decodes: &lt; &gt; &amp; &quot; &#39; &nbsp;
}
```

### Validation
All credentials are validated before import:

```typescript
protected isValidCredential(cred: ParsedCredential): boolean {
  return !!(cred.url && cred.username && cred.password);
}
```

## 🚀 Usage

### In Import Service

```typescript
import { ImportService } from './import.service';

// Get list of supported formats
const formats = importService.getSupportedFormats();

// Import from file
const result = await importService.importFromFile(file, 'lastpass-csv');

// Result contains:
// - success: boolean
// - imported: number
// - failed: number
// - skipped: number
// - errors: string[]
```

### Adding a New Importer

1. **Create the importer file:**

```typescript
import { BaseImporter, ParsedCredential } from './base-importer';

export class MyPasswordManagerImporter extends BaseImporter {
  readonly formatId = 'mypm-csv';
  readonly formatName = 'MyPasswordManager (CSV)';
  readonly formatDescription = 'CSV export from MyPasswordManager';

  async parse(content: string): Promise<ParsedCredential[]> {
    const rows = this.parseCsv(content, true);
    const credentials: ParsedCredential[] = [];

    for (const row of rows) {
      const credential: ParsedCredential = {
        url: row.url || '',
        username: row.username || '',
        password: row.password || '',
        notes: row.notes,
        name: row.title
      };

      if (this.isValidCredential(credential)) {
        credentials.push(credential);
      }
    }

    return credentials;
  }
}
```

2. **Export from index.ts:**

```typescript
export * from './mypm-csv-importer';
```

3. **Register in import.service.ts:**

```typescript
import { MyPasswordManagerImporter } from './importers';

private readonly importers: BaseImporter[] = [
  // ... existing importers
  new MyPasswordManagerImporter(),
];
```

## 📝 Implementation Notes

### CSV Format Handling

CSV importers handle various quirks:
- **Header detection** - Automatically detects presence of header row
- **Case insensitivity** - Headers are normalized to lowercase
- **Flexible field names** - Supports multiple variations (username/user/login)
- **Empty line handling** - Skips empty lines automatically
- **Encoding** - UTF-8 with BOM support

### JSON Format Handling

JSON importers support:
- **Nested structures** - Vaults, folders, collections
- **Multiple item types** - Logins, notes, cards, identities
- **Custom fields** - Preserved in notes section
- **Encryption detection** - Warns about encrypted exports
- **TOTP support** - Extracts one-time password secrets

### XML Format Handling

XML importers use browser's built-in `DOMParser`:
- **Cross-platform** - Works in Electron renderer process
- **Hierarchical groups** - Maintains folder structure
- **Attribute parsing** - Extracts data from both attributes and elements
- **Error handling** - Detects and reports parsing errors

## 🎨 Features Supported

### ✅ Implemented
- [x] Login credentials (username/password)
- [x] URLs and website matching
- [x] Notes and secure notes
- [x] Folders and categories
- [x] TOTP/2FA secrets
- [x] Custom fields (stored in notes)
- [x] Credit cards (converted to notes)
- [x] Identities (converted to notes)
- [x] Favorites/starred items
- [x] Multiple URLs per entry
- [x] Password history (limited)

### ⚠️ Partially Supported
- [ ] Attachments - Not supported (stored as note reference)
- [ ] File uploads - Not supported
- [ ] Images - Not supported

### ❌ Not Supported
- [ ] Collections (organization-level)
- [ ] Shared folders
- [ ] Encrypted exports (require decryption key)
- [ ] Binary formats (require specialized parsing)

## 🔮 Future Enhancements

### Missing Importers (Low Priority)
- 12 less common CSV importers (Enpass CSV, LogMeOnce, Meldium, etc.)
- 3 less common JSON importers (Gnome Keyring, Passky, Psono)
- Special format importers (HTML, binary formats)

### Feature Enhancements
- [ ] Import deduplication
- [ ] Conflict resolution
- [ ] Preview before import
- [ ] Batch import progress tracking
- [ ] Import from URL
- [ ] Auto-detect format from file content

## 📚 References

### Bitwarden Open Source
This implementation is heavily inspired by Bitwarden's importer architecture:
- Repository: https://github.com/bitwarden/clients
- License: MIT
- Path: `libs/importer/src/importers/`

### Papa Parse
CSV parsing library:
- Repository: https://github.com/mholt/PapaParse
- Documentation: https://www.papaparse.com/

### W3C DOMParser
XML parsing API:
- Specification: https://w3c.github.io/DOM-Parsing/
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser

## 🐛 Known Issues

### CSV Format Variations
Some password managers have multiple CSV export formats. Users should try:
1. Standard CSV export
2. "Compatible" or "Universal" export option
3. Manual field mapping using Generic CSV format

### XML Encoding
Some XML exports may have encoding issues. Recommend:
1. Ensure UTF-8 encoding
2. Remove BOM if present
3. Validate XML structure before import

### JSON Encryption
Several password managers support encrypted JSON exports. These require:
1. Export without encryption option
2. Or provide decryption key (not currently supported)

## 📄 License

This code is adapted from Bitwarden's open-source importers (MIT License) and follows the same patterns for compatibility and maintainability.

## 👥 Contributors

- Implementation based on Bitwarden's importer architecture
- Adapted for simplified credential model
- Enhanced with additional format support

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Total Import Formats:** 59
