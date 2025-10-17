import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// API Service - Handles REST API calls to the Go server
/// Used for authentication and non-GraphQL operations
class ApiService {
  // Use localhost for local development
  // For iOS simulator, localhost works fine
  // For physical device, use your computer's IP address
  static const String _baseUrl = 'http://localhost:8080/api/v1';
  static final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  /// Register new user
  static Future<Map<String, dynamic>> register({
    required String username,
    required String password,
    required String deviceName,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': username,
        'password': password,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);

      // Save auth tokens
      if (data['access_token'] != null) {
        await _secureStorage.write(key: 'access_token', value: data['access_token']);
      }
      if (data['refresh_token'] != null) {
        await _secureStorage.write(key: 'refresh_token', value: data['refresh_token']);
      }

      return data;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error'] ?? 'Registration failed');
    }
  }

  /// Login user
  static Future<Map<String, dynamic>> login({
    required String username,
    required String password,
    required String deviceName,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': username,
        'password': password,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);

      // Save auth tokens
      if (data['access_token'] != null) {
        await _secureStorage.write(key: 'access_token', value: data['access_token']);
      }
      if (data['refresh_token'] != null) {
        await _secureStorage.write(key: 'refresh_token', value: data['refresh_token']);
      }

      return data;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error'] ?? 'Login failed');
    }
  }

  /// Logout user
  static Future<void> logout() async {
    await _secureStorage.delete(key: 'access_token');
    await _secureStorage.delete(key: 'refresh_token');
  }

  /// Get authenticated headers
  static Future<Map<String, String>> getAuthHeaders() async {
    final token = await _secureStorage.read(key: 'access_token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Pull sync from server - Get all credentials, keys, and metadata
  static Future<Map<String, dynamic>> pullSync({
    String zone = 'default',
    int lastGenCount = 0,
    bool includeTombstoned = false,
  }) async {
    final headers = await getAuthHeaders();

    final response = await http.post(
      Uri.parse('$_baseUrl/sync/pull'),
      headers: headers,
      body: jsonEncode({
        'zone': zone,
        'last_gencount': lastGenCount,
        'include_tombstoned': includeTombstoned,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error'] ?? 'Pull sync failed');
    }
  }

  /// Get sync manifest - Check current server gencount
  static Future<Map<String, dynamic>> getSyncManifest({
    String zone = 'default',
  }) async {
    final headers = await getAuthHeaders();

    final response = await http.get(
      Uri.parse('$_baseUrl/sync/manifest?zone=$zone'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error'] ?? 'Failed to get sync manifest');
    }
  }

  /// Delete all credentials from server - Mark all as tombstoned
  static Future<Map<String, dynamic>> deleteAllCredentials({
    String zone = 'default',
  }) async {
    final headers = await getAuthHeaders();

    final response = await http.delete(
      Uri.parse('$_baseUrl/sync/credentials?zone=$zone'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error'] ?? 'Failed to delete all credentials');
    }
  }
}
