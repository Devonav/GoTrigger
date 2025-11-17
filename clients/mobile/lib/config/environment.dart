/// Environment Configuration
///
/// This file contains environment-specific settings.
/// You can change the API base URL based on your testing setup:
///
/// For local development on simulator: Use 'localhost'
/// For testing on physical device: Use your computer's IP (e.g., '192.168.86.22')

class Environment {
  // API Configuration
  // Change this to your computer's IP address when testing on physical devices
  // For iOS simulator: 'http://localhost:8080' works fine
  // For physical device: Use your Mac's IP like 'http://192.168.86.22:8080'
  // Production server: 'https://gotrigger.org'
  static const String apiBaseUrl = 'https://gotrigger.org';

  // WebSocket Configuration
  // Production server: 'wss://gotrigger.org'
  static const String wsBaseUrl = 'wss://gotrigger.org';

  // API Version
  static const String apiVersion = 'v1';

  // Computed URLs
  static String get apiUrl => '$apiBaseUrl/api/$apiVersion';
  static String get wsUrl => '$wsBaseUrl/api/$apiVersion';
  static String get graphqlUrl => '$apiBaseUrl/graphql';
}

/// Production Environment Configuration
class ProductionEnvironment {
  static const String apiBaseUrl = 'https://gotrigger.org';
  static const String wsBaseUrl = 'wss://gotrigger.org';
  static const String apiVersion = 'v1';

  static String get apiUrl => '$apiBaseUrl/api/$apiVersion';
  static String get wsUrl => '$wsBaseUrl/api/$apiVersion';
  static String get graphqlUrl => '$apiBaseUrl/graphql';
}
