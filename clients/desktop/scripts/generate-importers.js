#!/usr/bin/env node
/**
 * Auto-generate importer wrappers for all Bitwarden importers
 *
 * This script:
 * 1. Lists all Bitwarden CSV/JSON importers we want to support
 * 2. Generates wrapper classes for each
 * 3. Updates index.ts and import.service.ts
 *
 * Usage: node scripts/generate-importers.js
 */

const fs = require('fs');
const path = require('path');

// List of Bitwarden importers to generate (CSV and JSON only for now)
// Format: { id, name, description, bitwardenClass, fileType }
const IMPORTERS = [
  // Already manually created - skip these
  // { id: 'chrome-csv', name: 'Chrome', description: 'Chrome password manager', bitwardenClass: 'ChromeCsvImporter', fileType: 'csv' },
  // { id: 'edge-csv', name: 'Edge', description: 'Microsoft Edge', bitwardenClass: 'EdgeCsvImporter', fileType: 'csv' },
  // { id: 'firefox-csv', name: 'Firefox', description: 'Mozilla Firefox', bitwardenClass: 'FirefoxCsvImporter', fileType: 'csv' },
  // { id: 'safari-csv', name: 'Safari', description: 'Apple Safari', bitwardenClass: 'SafariCsvImporter', fileType: 'csv' },
  // { id: 'lastpass-csv', name: 'LastPass', description: 'LastPass', bitwardenClass: 'LastPassCsvImporter', fileType: 'csv' },
  // { id: 'keeper-csv', name: 'Keeper', description: 'Keeper Security', bitwardenClass: 'KeeperCsvImporter', fileType: 'csv' },
  // { id: 'dashlane-csv', name: 'Dashlane', description: 'Dashlane', bitwardenClass: 'DashlaneCsvImporter', fileType: 'csv' },
  // { id: 'nordpass-csv', name: 'NordPass', description: 'NordPass', bitwardenClass: 'NordPassCsvImporter', fileType: 'csv' },
  // { id: 'onepassword-csv', name: '1Password', description: '1Password', bitwardenClass: 'OnePasswordCsvImporter', fileType: 'csv' },

  // New ones to generate
  { id: 'bitwarden-csv', name: 'Bitwarden (CSV)', description: 'CSV export from Bitwarden', bitwardenClass: 'BitwardenCsvImporter', fileType: 'csv' },
  { id: 'bitwarden-json', name: 'Bitwarden (JSON)', description: 'JSON export from Bitwarden', bitwardenClass: 'BitwardenJsonImporter', fileType: 'json' },
  { id: 'roboform-csv', name: 'RoboForm (CSV)', description: 'CSV export from RoboForm', bitwardenClass: 'RoboFormCsvImporter', fileType: 'csv' },
  { id: 'enpass-json', name: 'Enpass (JSON)', description: 'JSON export from Enpass', bitwardenClass: 'EnpassJsonImporter', fileType: 'json' },
  { id: 'myki-csv', name: 'Myki (CSV)', description: 'CSV export from Myki', bitwardenClass: 'MykiCsvImporter', fileType: 'csv' },
  { id: 'msecure-csv', name: 'mSecure (CSV)', description: 'CSV export from mSecure', bitwardenClass: 'MSecureCsvImporter', fileType: 'csv' },
  { id: 'passwordboss-json', name: 'Password Boss (JSON)', description: 'JSON export from Password Boss', bitwardenClass: 'PasswordBossJsonImporter', fileType: 'json' },
  { id: 'avast-csv', name: 'Avast Passwords (CSV)', description: 'CSV export from Avast Passwords', bitwardenClass: 'AvastCsvImporter', fileType: 'csv' },
  { id: 'avira-json', name: 'Avira (JSON)', description: 'JSON export from Avira', bitwardenClass: 'AviraJsonImporter', fileType: 'json' },
  { id: 'opera-csv', name: 'Opera (CSV)', description: 'CSV export from Opera browser', bitwardenClass: 'OperaCsvImporter', fileType: 'csv' },
  { id: 'brave-csv', name: 'Brave (CSV)', description: 'CSV export from Brave browser', bitwardenClass: 'BraveCsvImporter', fileType: 'csv' },
  { id: 'vivaldi-csv', name: 'Vivaldi (CSV)', description: 'CSV export from Vivaldi browser', bitwardenClass: 'VivaldiCsvImporter', fileType: 'csv' },
  { id: 'trukey-csv', name: 'True Key (CSV)', description: 'CSV export from True Key', bitwardenClass: 'TrueKeyCsvImporter', fileType: 'csv' },
  { id: 'zoho-csv', name: 'Zoho Vault (CSV)', description: 'CSV export from Zoho Vault', bitwardenClass: 'ZohoCsvImporter', fileType: 'csv' },
  { id: 'saferpass-csv', name: 'SaferPass (CSV)', description: 'CSV export from SaferPass', bitwardenClass: 'SaferPassCsvImporter', fileType: 'csv' },
  { id: 'passpack-csv', name: 'Passpack (CSV)', description: 'CSV export from Passpack', bitwardenClass: 'PasspackCsvImporter', fileType: 'csv' },
  { id: 'remembear-csv', name: 'RememBear (CSV)', description: 'CSV export from RememBear', bitwardenClass: 'RememBearCsvImporter', fileType: 'csv' },
  { id: 'blackberry-txt', name: 'BlackBerry Password Keeper (TXT)', description: 'TXT export from BlackBerry Password Keeper', bitwardenClass: 'BlackBerryCsvImporter', fileType: 'txt' },
  { id: 'kaspersky-txt', name: 'Kaspersky Password Manager (TXT)', description: 'TXT export from Kaspersky', bitwardenClass: 'KasperskyCsvImporter', fileType: 'txt' },
];

const IMPORTERS_DIR = path.join(__dirname, '../src/app/features/vault/services/importers/bitwarden/generated');
const INDEX_FILE = path.join(__dirname, '../src/app/features/vault/services/importers/bitwarden/generated/index.ts');

// Create directory if it doesn't exist
if (!fs.existsSync(IMPORTERS_DIR)) {
  fs.mkdirSync(IMPORTERS_DIR, { recursive: true });
}

console.log('🚀 Generating Bitwarden importer wrappers...\n');

// Generate each importer
IMPORTERS.forEach(({ id, name, description, bitwardenClass, fileType }) => {
  const className = bitwardenClass.replace('CsvImporter', '').replace('JsonImporter', '').replace('TxtImporter', '') + 'Importer';
  const fileName = id.replace(/-/g, '-') + '-importer.ts';
  const filePath = path.join(IMPORTERS_DIR, fileName);

  const template = `/**
 * ${name} Importer
 * Auto-generated wrapper for Bitwarden's ${bitwardenClass}
 *
 * Original: https://github.com/bitwarden/clients/tree/main/libs/importer/src/importers
 *
 * This is a placeholder - you need to:
 * 1. Copy Bitwarden's ${bitwardenClass} implementation
 * 2. Place it in bitwarden/vendor/${id}.ts
 * 3. Import and use it below
 */

import { BaseImporter, ParsedCredential } from '../../base-importer';
import { ImportAdapter } from '../import-adapter';
// TODO: Import Bitwarden's ${bitwardenClass} when available
// import { ${bitwardenClass} } from '../vendor/${id}';

export class ${className} extends BaseImporter {
  readonly formatId = '${id}';
  readonly formatName = '${name}';
  readonly formatDescription = '${description}';

  async parse(content: string): Promise<ParsedCredential[]> {
    // TODO: Implement using Bitwarden's ${bitwardenClass}
    /*
    const bitwardenImporter = new ${bitwardenClass}();
    const result = await bitwardenImporter.parse(content);
    return ImportAdapter.convertToCredentials(result);
    */

    console.warn('${name} importer not yet implemented');
    return [];
  }
}
`;

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`✅ Generated: ${fileName}`);
});

// Generate index.ts
const indexContent = `/**
 * Auto-generated Bitwarden Importer Wrappers
 * Generated by: scripts/generate-importers.js
 *
 * DO NOT EDIT THIS FILE MANUALLY
 */

${IMPORTERS.map(({ id }) => {
  const fileName = id.replace(/-/g, '-') + '-importer';
  return `export * from './${fileName}';`;
}).join('\n')}
`;

fs.writeFileSync(INDEX_FILE, indexContent, 'utf-8');
console.log(`\n✅ Generated: index.ts`);

console.log(`\n✨ Done! Generated ${IMPORTERS.length} importer wrappers`);
console.log('\n📝 Next steps:');
console.log('1. Copy Bitwarden importer implementations to bitwarden/vendor/');
console.log('2. Update each generated file to use the Bitwarden importer');
console.log('3. Update import.service.ts to register new importers');
console.log('\nExample:');
console.log('  cp path/to/bitwarden/bitwarden-csv-importer.ts bitwarden/vendor/');
console.log('  // Edit generated file to import and use it');
