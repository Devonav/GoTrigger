import 'dart:convert';
import 'package:csv/csv.dart';
import '../shared/models/credential.dart';

/// Parsed credential from import file
class ParsedCredential {
  final String url;
  final String username;
  final String password;
  final String? notes;
  final String? name;

  ParsedCredential({
    required this.url,
    required this.username,
    required this.password,
    this.notes,
    this.name,
  });
}

/// Import result summary
class ImportResult {
  final bool success;
  final int imported;
  final int failed;
  final int skipped;
  final List<String> errors;

  ImportResult({
    required this.success,
    required this.imported,
    required this.failed,
    required this.skipped,
    required this.errors,
  });
}

/// Import format metadata
class ImportFormat {
  final String id;
  final String name;
  final String description;
  final String fileExtension;

  ImportFormat({
    required this.id,
    required this.name,
    required this.description,
    required this.fileExtension,
  });
}

/// Import Service - Handles CSV/JSON import from various password managers
/// Client-side only (no plaintext data sent to server)
class ImportService {
  /// Get list of supported import formats
  static List<ImportFormat> getSupportedFormats() {
    return [
      // CSV Importers - Major Password Managers
      ImportFormat(
        id: 'lastpass-csv',
        name: 'LastPass',
        description: 'LastPass CSV export',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'onepassword-csv',
        name: '1Password',
        description: '1Password CSV export',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'bitwarden-csv',
        name: 'Bitwarden',
        description: 'Bitwarden CSV export',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'dashlane-csv',
        name: 'Dashlane',
        description: 'Dashlane CSV export',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'nordpass-csv',
        name: 'NordPass',
        description: 'NordPass CSV export',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'keeper-csv',
        name: 'Keeper',
        description: 'Keeper Security CSV export',
        fileExtension: 'csv',
      ),

      // Browser Password Managers
      ImportFormat(
        id: 'chrome-csv',
        name: 'Chrome',
        description: 'Google Chrome passwords',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'firefox-csv',
        name: 'Firefox',
        description: 'Mozilla Firefox passwords',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'safari-csv',
        name: 'Safari',
        description: 'Safari passwords',
        fileExtension: 'csv',
      ),
      ImportFormat(
        id: 'edge-csv',
        name: 'Edge',
        description: 'Microsoft Edge passwords',
        fileExtension: 'csv',
      ),

      // JSON Importers
      ImportFormat(
        id: 'bitwarden-json',
        name: 'Bitwarden (JSON)',
        description: 'Bitwarden JSON export',
        fileExtension: 'json',
      ),
      ImportFormat(
        id: 'protonpass-json',
        name: 'Proton Pass',
        description: 'Proton Pass JSON export',
        fileExtension: 'json',
      ),

      // Generic
      ImportFormat(
        id: 'generic-csv',
        name: 'Generic CSV',
        description: 'Basic CSV with url, username, password',
        fileExtension: 'csv',
      ),
    ];
  }

  /// Parse CSV content into credentials
  static Future<List<ParsedCredential>> parseContent(
    String content,
    String formatId,
  ) async {
    if (formatId.endsWith('-json')) {
      return _parseJson(content, formatId);
    } else {
      return _parseCsv(content, formatId);
    }
  }

  /// Parse CSV file
  static Future<List<ParsedCredential>> _parseCsv(
    String content,
    String formatId,
  ) async {
    try {
      // Parse CSV using csv package
      final rows = const CsvToListConverter(
        shouldParseNumbers: false,
        eol: '\n',
      ).convert(content);

      if (rows.isEmpty) {
        return [];
      }

      // Get headers (first row)
      final headers = rows[0].map((h) => h.toString().toLowerCase().trim()).toList();
      final credentials = <ParsedCredential>[];

      // Process data rows
      for (var i = 1; i < rows.length; i++) {
        final row = rows[i];
        if (row.isEmpty) continue;

        // Build map from headers
        final Map<String, String> rowMap = {};
        for (var j = 0; j < headers.length && j < row.length; j++) {
          rowMap[headers[j]] = row[j]?.toString().trim() ?? '';
        }

        // Parse based on format
        final credential = _parseCredentialFromRow(rowMap, formatId);
        if (credential != null && _isValidCredential(credential)) {
          credentials.add(credential);
        }
      }

      return credentials;
    } catch (e) {
      print('CSV parse error: $e');
      return [];
    }
  }

  /// Parse credential from CSV row based on format
  static ParsedCredential? _parseCredentialFromRow(
    Map<String, String> row,
    String formatId,
  ) {
    String url = '';
    String username = '';
    String password = '';
    String? notes;
    String? name;

    switch (formatId) {
      case 'lastpass-csv':
        url = row['url'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        notes = row['extra'] ?? row['notes'];
        name = row['name'] ?? row['title'];
        break;

      case 'onepassword-csv':
        url = row['url'] ?? row['website'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        notes = row['notes'];
        name = row['title'] ?? row['name'];
        break;

      case 'bitwarden-csv':
        url = row['login_uri'] ?? row['url'] ?? '';
        username = row['login_username'] ?? row['username'] ?? '';
        password = row['login_password'] ?? row['password'] ?? '';
        notes = row['notes'];
        name = row['name'];
        break;

      case 'dashlane-csv':
        url = row['url'] ?? row['website'] ?? '';
        username = row['username'] ?? row['login'] ?? row['email'] ?? '';
        password = row['password'] ?? '';
        notes = row['note'] ?? row['notes'];
        name = row['title'] ?? row['name'];
        break;

      case 'nordpass-csv':
        url = row['url'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        notes = row['note'] ?? row['notes'];
        name = row['name'];
        break;

      case 'keeper-csv':
        url = row['url'] ?? row['website url'] ?? '';
        username = row['login'] ?? row['username'] ?? '';
        password = row['password'] ?? '';
        notes = row['notes'];
        name = row['title'] ?? row['name'];
        break;

      case 'chrome-csv':
      case 'edge-csv':
        url = row['url'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        name = row['name'];
        break;

      case 'firefox-csv':
        url = row['url'] ?? row['hostname'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        break;

      case 'safari-csv':
        url = row['url'] ?? '';
        username = row['username'] ?? '';
        password = row['password'] ?? '';
        break;

      case 'generic-csv':
      default:
        // Try common field names
        url = row['url'] ?? row['website'] ?? row['site'] ?? row['login_uri'] ?? '';
        username = row['username'] ?? row['user'] ?? row['login_username'] ?? row['email'] ?? '';
        password = row['password'] ?? row['pass'] ?? row['login_password'] ?? '';
        notes = row['notes'] ?? row['note'] ?? row['comment'];
        name = row['name'] ?? row['title'];
        break;
    }

    // Sanitize values (prevent CSV injection)
    url = _sanitizeValue(url);
    username = _sanitizeValue(username);
    password = _sanitizeValue(password);

    if (url.isEmpty || username.isEmpty || password.isEmpty) {
      return null;
    }

    return ParsedCredential(
      url: url,
      username: username,
      password: password,
      notes: notes?.isNotEmpty == true ? notes : null,
      name: name?.isNotEmpty == true ? name : null,
    );
  }

  /// Parse JSON file
  static Future<List<ParsedCredential>> _parseJson(
    String content,
    String formatId,
  ) async {
    try {
      final data = jsonDecode(content);
      final credentials = <ParsedCredential>[];

      switch (formatId) {
        case 'bitwarden-json':
          final items = data['items'] as List<dynamic>? ?? [];
          for (var item in items) {
            if (item['type'] == 1) {
              // Login type
              final login = item['login'] as Map<String, dynamic>?;
              if (login != null) {
                final uri = (login['uris'] as List<dynamic>?)?.first;
                credentials.add(ParsedCredential(
                  url: uri?['uri'] ?? '',
                  username: login['username'] ?? '',
                  password: login['password'] ?? '',
                  notes: item['notes'],
                  name: item['name'],
                ));
              }
            }
          }
          break;

        case 'protonpass-json':
          final vaults = data['vaults'] as Map<String, dynamic>? ?? {};
          for (var vault in vaults.values) {
            final items = vault['items'] as List<dynamic>? ?? [];
            for (var item in items) {
              final content = item['content'] as Map<String, dynamic>?;
              if (content != null && content['itemType'] == 'login') {
                credentials.add(ParsedCredential(
                  url: content['urls']?.first ?? '',
                  username: content['username'] ?? '',
                  password: content['password'] ?? '',
                  notes: content['note'],
                  name: item['metadata']?['name'],
                ));
              }
            }
          }
          break;
      }

      return credentials;
    } catch (e) {
      print('JSON parse error: $e');
      return [];
    }
  }

  /// Sanitize value to prevent CSV injection
  static String _sanitizeValue(String value) {
    if (value.isEmpty) return '';
    // Remove leading formula characters
    return value.replaceFirst(RegExp(r'^[=@+\-\t\r]'), '').trim();
  }

  /// Check if credential has required fields
  static bool _isValidCredential(ParsedCredential cred) {
    return cred.url.isNotEmpty &&
        cred.username.isNotEmpty &&
        cred.password.isNotEmpty;
  }
}
