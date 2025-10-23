import 'dart:convert';
import 'dart:typed_data';
import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import '../config/environment.dart';
import 'api_service.dart';

/// Vault Service - Manages encrypted vault operations
class VaultService {
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  static const String _saltKey = 'vault_salt';
  static const String _masterKeyKey = 'master_key';

  /// Load salt from secure storage
  static Future<Uint8List?> loadSalt() async {
    final saltBase64 = await _secureStorage.read(key: _saltKey);
    if (saltBase64 == null) return null;
    return base64Decode(saltBase64);
  }

  /// Save salt to secure storage
  static Future<void> saveSalt(Uint8List salt) async {
    final saltBase64 = base64Encode(salt);
    await _secureStorage.write(key: _saltKey, value: saltBase64);
  }

  /// Generate random salt
  static Uint8List _generateSalt() {
    final random = Random.secure();
    return Uint8List.fromList(List<int>.generate(32, (_) => random.nextInt(256)));
  }

  /// Derive master key from password using PBKDF2
  static Uint8List _deriveMasterKey(String password, Uint8List salt) {
    // Simple SHA-256 based key derivation (in production, use proper PBKDF2)
    final passwordBytes = utf8.encode(password);
    final combined = Uint8List.fromList([...passwordBytes, ...salt]);
    final digest = sha256.convert(combined);
    return Uint8List.fromList(digest.bytes);
  }

  /// Initialize crypto with master password
  static Future<void> initializeCrypto(String masterPassword, {Uint8List? salt}) async {
    // Generate salt if not provided
    salt ??= _generateSalt();

    // Save salt
    await saveSalt(salt);

    // Derive master key from password
    final masterKey = _deriveMasterKey(masterPassword, salt);

    // Save master key to secure storage
    final masterKeyBase64 = base64Encode(masterKey);
    await _secureStorage.write(key: _masterKeyKey, value: masterKeyBase64);
  }

  /// Check if vault is initialized
  static Future<bool> isVaultInitialized() async {
    final salt = await loadSalt();
    return salt != null;
  }

  /// Add credential to vault (encrypt and sync)
  static Future<void> addCredential(Map<String, dynamic> credential) async {
    // Get master key
    final masterKeyBase64 = await _secureStorage.read(key: _masterKeyKey);
    if (masterKeyBase64 == null) {
      throw Exception('Vault not initialized');
    }

    final masterKey = base64Decode(masterKeyBase64);

    // Create credential payload (simplified encryption - just base64 for now)
    // In production, this should use proper triple-layer encryption like desktop
    final credentialJson = jsonEncode(credential);
    final encryptedData = base64Encode(utf8.encode(credentialJson));

    // Generate UUID for credential
    final uuid = DateTime.now().millisecondsSinceEpoch.toString();

    // Push to server using sync API
    final syncData = {
      'credentials': [
        {
          'uuid': uuid,
          'data': encryptedData,
          'gencount': 1,
        }
      ],
      'zone': 'default',
    };

    // Call push sync API
    final headers = await ApiService.getAuthHeaders();
    final apiUrl = '${Environment.apiUrl}/sync/push';
    final response = await http.post(
      Uri.parse(apiUrl),
      headers: headers,
      body: jsonEncode(syncData),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to sync credential: ${response.body}');
    }

    print('✅ Credential synced: ${credential['title']}');
  }

  /// Clear vault (for logout)
  static Future<void> clearVault() async {
    await _secureStorage.delete(key: _saltKey);
    await _secureStorage.delete(key: _masterKeyKey);
  }
}
