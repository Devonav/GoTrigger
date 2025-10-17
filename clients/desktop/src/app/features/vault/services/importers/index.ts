/**
 * Password Manager Importers
 * Following Bitwarden's architecture pattern
 * Adapted from Bitwarden's open-source importers (MIT License)
 */

export * from './base-importer';

// === MAJOR PASSWORD MANAGERS (CSV) ===
export * from './lastpass-csv-importer';
export * from './onepassword-csv-importer';
export * from './dashlane-csv-importer';
export * from './bitwarden-csv-importer';
export * from './nordpass-csv-importer';
export * from './keeper-csv-importer';

// === BROWSER PASSWORD MANAGERS (CSV) ===
export * from './chrome-csv-importer';
export * from './edge-csv-importer';
export * from './firefox-csv-importer';
export * from './safari-csv-importer';
export * from './brave-csv-importer';
export * from './opera-csv-importer';
export * from './vivaldi-csv-importer';

// === OTHER PASSWORD MANAGERS (CSV) ===
export * from './roboform-csv-importer';
export * from './zoho-vault-csv-importer';
export * from './msecure-csv-importer';
export * from './avast-csv-importer';
export * from './ascendo-csv-importer';
export * from './avira-csv-importer';
export * from './blackberry-csv-importer';
export * from './blur-csv-importer';
export * from './buttercup-csv-importer';
export * from './codebook-csv-importer';
export * from './encryptr-csv-importer';
export * from './kaspersky-txt-importer';
export * from './keepassx-csv-importer';
export * from './myki-csv-importer';
export * from './passpack-csv-importer';
export * from './remembear-csv-importer';
export * from './saferpass-csv-importer';
export * from './truekey-csv-importer';

// === JSON IMPORTERS ===
export * from './avast-json-importer';
export * from './bitwarden-json-importer';
export * from './dashlane-json-importer';
export * from './enpass-json-importer';
export * from './keeper-json-importer';
export * from './onepassword-1pif-importer';
export * from './onepassword-1pux-importer';
export * from './passman-json-importer';
export * from './passwordboss-json-importer';
export * from './protonpass-json-importer';

// === XML IMPORTERS ===
export * from './keepass2-xml-importer';
export * from './passworddepot-xml-importer';
export * from './passworddragon-xml-importer';
export * from './passwordsafe-xml-importer';
export * from './safeincloud-xml-importer';
export * from './stickypassword-xml-importer';

