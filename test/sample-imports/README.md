# Sample Import Files

Test CSV files for the import feature.

## Files

### 1. generic-format.csv
Basic CSV format with: url, username, password, notes
- 5 sample credentials
- Use this for generic imports

### 2. bitwarden-format.csv
Bitwarden CSV export format
- Includes folders, favorites, login_uri, etc.
- 5 sample credentials
- Use this to test Bitwarden import compatibility

### 3. chrome-format.csv
Chrome password export format
- Includes name, url, username, password
- 5 sample credentials
- Use this to test Chrome import compatibility

### 4. lastpass-format.csv ⭐ NEW
LastPass CSV export format
- Format: url,username,password,totp,extra,name,grouping,fav
- 6 sample credentials with folders, favorites, TOTP, HTML entities
- Use this to test LastPass import (21.25% market share!)

### 5. firefox-format.csv 🦊 NEW
Firefox CSV export format
- Format: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
- 6 sample credentials with metadata
- Use this to test Firefox import

### 6. safari-format.csv 🍎 NEW
Safari/iCloud Keychain CSV export format
- Format: Title,Url,Username,Password,OTPAuth
- 6 sample credentials with OTP support
- Use this to test Safari import (note: case-sensitive headers!)

## Testing Instructions

1. Start the desktop app: `npm run electron:dev`
2. Register/Login and unlock vault
3. Click the "Import" button
4. Select format from dropdown:
   - LastPass (CSV)
   - Firefox (CSV)
   - Safari (CSV)
   - Bitwarden (CSV)
   - Chrome (CSV)
   - Generic (CSV)
5. Choose corresponding CSV file
6. Click Import
7. Verify credentials appear in vault
8. Check that notes contain folder/TOTP info for LastPass

## Format-Specific Notes

### LastPass
- Supports folders (stored in notes as "Folder: X")
- Supports TOTP codes (stored in notes as "TOTP: X")
- HTML entities are decoded (&amp; → &)
- Favorites marked in notes

### Firefox
- Includes metadata (timestamps, GUIDs) - ignored during import
- httpRealm included in notes if present
- Very clean, standards-compliant format

### Safari
- **Case-sensitive headers!** (Title, Url, Username, Password, OTPAuth)
- OTPAuth codes stored in notes if present
- Title used as credential name

## Security Note

⚠️ These are sample passwords for testing only. Never use these passwords for real accounts!
