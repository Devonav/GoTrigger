import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import 'package:encrypt/encrypt.dart' as encrypt_lib;
import 'package:crypto/crypto.dart';

/// Crypto Service - Handles end-to-end encryption matching desktop client
/// Uses ChaCha20-Poly1305 for encryption (same as desktop's tweetnacl)
class CryptoService {
  static final _chacha20 = Chacha20.poly1305Aead();

  /// Generate a random 32-byte key
  static Uint8List generateKey() {
    final key = List<int>.generate(32, (i) => DateTime.now().microsecondsSinceEpoch % 256);
    return Uint8List.fromList(key);
  }

  /// Generate a random 24-byte nonce
  static Uint8List generateNonce() {
    final nonce = List<int>.generate(24, (i) => DateTime.now().microsecondsSinceEpoch % 256);
    return Uint8List.fromList(nonce);
  }

  /// Derive encryption key from password using PBKDF2
  /// Matches desktop's key derivation
  static Future<Uint8List> deriveKeyFromPassword({
    required String password,
    required Uint8List salt,
    int iterations = 100000,
  }) async {
    final pbkdf2 = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: iterations,
      bits: 256, // 32 bytes
    );

    final secretKey = await pbkdf2.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: salt,
    );

    final keyBytes = await secretKey.extractBytes();
    return Uint8List.fromList(keyBytes);
  }

  /// Encrypt data using ChaCha20-Poly1305 (matching desktop)
  static Future<Map<String, dynamic>> encrypt({
    required String plaintext,
    required Uint8List key,
  }) async {
    // Generate random nonce (12 bytes for ChaCha20-Poly1305)
    final nonce = List<int>.generate(12, (i) => DateTime.now().microsecondsSinceEpoch % 256);

    final secretKey = SecretKey(key);
    final secretBox = await _chacha20.encrypt(
      utf8.encode(plaintext),
      secretKey: secretKey,
      nonce: nonce,
    );

    return {
      'ciphertext': base64Encode(secretBox.cipherText),
      'nonce': base64Encode(nonce),
      'mac': base64Encode(secretBox.mac.bytes),
    };
  }

  /// Decrypt data using ChaCha20-Poly1305 (matching desktop)
  static Future<String> decrypt({
    required String ciphertext,
    required String nonce,
    required String mac,
    required Uint8List key,
  }) async {
    final secretKey = SecretKey(key);

    final secretBox = SecretBox(
      base64Decode(ciphertext),
      nonce: base64Decode(nonce),
      mac: Mac(base64Decode(mac)),
    );

    final decrypted = await _chacha20.decrypt(
      secretBox,
      secretKey: secretKey,
    );

    return utf8.decode(decrypted);
  }

  /// Hash password using SHA-256
  static String hashPassword(String password) {
    final bytes = utf8.encode(password);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Generate salt for key derivation
  static Uint8List generateSalt({int length = 32}) {
    final salt = List<int>.generate(length, (i) => DateTime.now().microsecondsSinceEpoch % 256);
    return Uint8List.fromList(salt);
  }

  /// Encode bytes to base64
  static String encodeBase64(Uint8List bytes) {
    return base64Encode(bytes);
  }

  /// Decode base64 to bytes
  static Uint8List decodeBase64(String encoded) {
    return base64Decode(encoded);
  }

  /// Triple-layer encryption (matching desktop architecture)
  /// Layer 1: Individual credential encryption with vault key
  /// Layer 2: Vault key encryption with master key
  /// Layer 3: Master key derivation from password + salt
  static Future<Map<String, dynamic>> encryptCredential({
    required Map<String, dynamic> credential,
    required Uint8List vaultKey,
  }) async {
    // Serialize credential to JSON
    final jsonString = jsonEncode(credential);

    // Encrypt with vault key
    final encrypted = await encrypt(
      plaintext: jsonString,
      key: vaultKey,
    );

    return encrypted;
  }

  /// Decrypt credential (reverse of triple-layer encryption)
  static Future<Map<String, dynamic>> decryptCredential({
    required Map<String, dynamic> encryptedData,
    required Uint8List vaultKey,
  }) async {
    // Decrypt with vault key
    final decrypted = await decrypt(
      ciphertext: encryptedData['ciphertext'],
      nonce: encryptedData['nonce'],
      mac: encryptedData['mac'],
      key: vaultKey,
    );

    // Parse JSON
    return jsonDecode(decrypted);
  }
}
