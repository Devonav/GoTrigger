/**
 * Quick Importer Test - Validates all importers can parse their sample files
 * Run with: npx ts-node quick-importer-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import all importers (you'll need to adjust paths based on your setup)
const importersPath = '../../clients/desktop/src/app/features/vault/services/importers';

interface TestResult {
  importer: string;
  sampleFile: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  credentialsFound: number;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Test configuration
const tests = [
  { importerClass: 'LastPassCsvImporter', sampleFile: 'lastpass-format.csv', formatId: 'lastpass-csv' },
  { importerClass: 'OnePasswordCsvImporter', sampleFile: '1password-csv-format.csv', formatId: '1password-csv' },
  { importerClass: 'DashlaneCsvImporter', sampleFile: 'dashlane-csv-format.csv', formatId: 'dashlane-csv' },
  { importerClass: 'BitwardenCsvImporter', sampleFile: 'bitwarden-format.csv', formatId: 'bitwarden-csv' },
  { importerClass: 'NordPassCsvImporter', sampleFile: 'nordpass-csv-format.csv', formatId: 'nordpass-csv' },
  { importerClass: 'KeeperCsvImporter', sampleFile: 'keeper-csv-format.csv', formatId: 'keeper-csv' },
  { importerClass: 'ChromeCsvImporter', sampleFile: 'chrome-format.csv', formatId: 'chrome-csv' },
  { importerClass: 'EdgeCsvImporter', sampleFile: 'edge-csv-format.csv', formatId: 'edge-csv' },
  { importerClass: 'FirefoxCsvImporter', sampleFile: 'firefox-format.csv', formatId: 'firefox-csv' },
  { importerClass: 'SafariCsvImporter', sampleFile: 'safari-format.csv', formatId: 'safari-csv' },
  { importerClass: 'BraveCsvImporter', sampleFile: 'brave-csv-format.csv', formatId: 'brave-csv' },
  { importerClass: 'OperaCsvImporter', sampleFile: 'opera-csv-format.csv', formatId: 'opera-csv' },
  { importerClass: 'VivaldiCsvImporter', sampleFile: 'vivaldi-csv-format.csv', formatId: 'vivaldi-csv' },
  { importerClass: 'BitwardenJsonImporter', sampleFile: 'bitwarden-json-format.json', formatId: 'bitwarden-json' },
  { importerClass: 'OnePassword1PuxImporter', sampleFile: '1password-1pux-format.json', formatId: '1password-1pux' },
  { importerClass: 'ProtonPassJsonImporter', sampleFile: 'protonpass-json-format.json', formatId: 'protonpass-json' },
  { importerClass: 'EnpassJsonImporter', sampleFile: 'enpass-json-format.json', formatId: 'enpass-json' },
  { importerClass: 'KeePass2XmlImporter', sampleFile: 'keepass2-xml-format.xml', formatId: 'keepass2-xml' }
];

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Quick Importer Validation Test                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const sampleDir = __dirname;

  for (const test of tests) {
    const startTime = performance.now();
    const samplePath = path.join(sampleDir, test.sampleFile);

    try {
      // Check if sample file exists
      if (!fs.existsSync(samplePath)) {
        results.push({
          importer: test.importerClass,
          sampleFile: test.sampleFile,
          status: 'SKIP',
          credentialsFound: 0,
          error: 'Sample file not found',
          duration: 0
        });
        continue;
      }

      // Read sample file
      const content = fs.readFileSync(samplePath, 'utf-8');

      // Dynamically import the importer class
      const importerModule = await import(path.join(importersPath, test.importerClass.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1)));
      const ImporterClass = importerModule[test.importerClass];
      const importer = new ImporterClass();

      // Parse the content
      const credentials = await importer.parse(content);
      const duration = performance.now() - startTime;

      results.push({
        importer: test.importerClass,
        sampleFile: test.sampleFile,
        status: credentials.length > 0 ? 'PASS' : 'FAIL',
        credentialsFound: credentials.length,
        error: credentials.length === 0 ? 'No credentials parsed' : undefined,
        duration: Math.round(duration)
      });

    } catch (error: any) {
      const duration = performance.now() - startTime;
      results.push({
        importer: test.importerClass,
        sampleFile: test.sampleFile,
        status: 'FAIL',
        credentialsFound: 0,
        error: error.message || 'Unknown error',
        duration: Math.round(duration)
      });
    }
  }

  // Print results
  console.log('\n📊 Test Results:\n');
  console.log('┌────────────────────────────────────┬────────┬───────────┬──────────┐');
  console.log('│ Importer                           │ Status │ Creds     │ Time(ms) │');
  console.log('├────────────────────────────────────┼────────┼───────────┼──────────┤');

  for (const result of results) {
    const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '○';
    const statusColor = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
    const resetColor = '\x1b[0m';

    const importerName = result.importer.padEnd(34);
    const status = `${statusColor}${statusIcon} ${result.status}${resetColor}`.padEnd(14);
    const creds = result.credentialsFound.toString().padStart(9);
    const time = result.duration.toString().padStart(8);

    console.log(`│ ${importerName} │ ${status} │ ${creds} │ ${time} │`);

    if (result.error && result.status !== 'SKIP') {
      console.log(`│   Error: ${result.error.substring(0, 60).padEnd(60)} │`);
    }
  }

  console.log('└────────────────────────────────────┴────────┴───────────┴──────────┘\n');

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('📈 Summary:');
  console.log(`   Total:   ${total}`);
  console.log(`   \x1b[32mPassed:  ${passed}\x1b[0m`);
  console.log(`   \x1b[31mFailed:  ${failed}\x1b[0m`);
  console.log(`   \x1b[33mSkipped: ${skipped}\x1b[0m`);
  console.log();

  if (failed > 0) {
    console.log('\x1b[31m✗ Some tests failed!\x1b[0m\n');
    process.exit(1);
  } else if (passed > 0) {
    console.log('\x1b[32m✓ All tests passed!\x1b[0m\n');
    process.exit(0);
  } else {
    console.log('\x1b[33m○ No tests were run (all skipped)\x1b[0m\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
