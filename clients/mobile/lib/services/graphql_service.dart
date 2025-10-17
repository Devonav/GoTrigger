import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// GraphQL Service - Handles GraphQL client configuration and authentication
/// Connects to the Go server API for syncing credentials
class GraphQLService {
  // Use localhost for local development
  // For iOS simulator, localhost works fine
  // For physical device, use your computer's IP address
  static const String _defaultEndpoint = 'http://192.168.86.22:8080/graphql';
  static final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  static GraphQLClient? _client;
  static ValueNotifier<GraphQLClient>? _clientNotifier;

  /// Initialize GraphQL client with authentication token
  static Future<ValueNotifier<GraphQLClient>> initializeClient({
    String? endpoint,
    String? authToken,
  }) async {
    final httpLink = HttpLink(
      endpoint ?? _defaultEndpoint,
    );

    // Get auth token from secure storage if not provided
    final token = authToken ?? await _secureStorage.read(key: 'access_token');

    AuthLink? authLink;
    if (token != null && token.isNotEmpty) {
      authLink = AuthLink(
        getToken: () async => 'Bearer $token',
      );
    }

    final Link link = authLink != null
        ? authLink.concat(httpLink)
        : httpLink;

    _client = GraphQLClient(
      link: link,
      cache: GraphQLCache(
        store: InMemoryStore(),
      ),
    );

    _clientNotifier = ValueNotifier<GraphQLClient>(_client!);
    return _clientNotifier!;
  }

  /// Update authentication token and reinitialize client
  static Future<void> updateAuthToken(String token) async {
    await _secureStorage.write(key: 'auth_token', value: token);
    await initializeClient(authToken: token);
  }

  /// Clear authentication token
  static Future<void> clearAuthToken() async {
    await _secureStorage.delete(key: 'auth_token');
    await initializeClient();
  }

  /// Get current client (throws if not initialized)
  static GraphQLClient getClient() {
    if (_client == null) {
      throw Exception('GraphQL client not initialized. Call initializeClient() first.');
    }
    return _client!;
  }

  /// Get client notifier for GraphQLProvider
  static ValueNotifier<GraphQLClient>? getClientNotifier() {
    return _clientNotifier;
  }
}
