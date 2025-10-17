import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/error_codes.dart' as auth_error;

class BiometricService {
  static final LocalAuthentication _localAuth = LocalAuthentication();
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  // Storage keys
  static const String _keyBiometricEnabled = 'biometric_enabled';
  static const String _keyStoredUsername = 'stored_username';
  static const String _keyStoredPassword = 'stored_password';

  /// Check if biometric authentication is available on this device
  static Future<bool> isBiometricAvailable() async {
    try {
      final bool canAuthenticateWithBiometrics = await _localAuth.canCheckBiometrics;
      final bool canAuthenticate = canAuthenticateWithBiometrics || await _localAuth.isDeviceSupported();
      return canAuthenticate;
    } catch (e) {
      print('Error checking biometric availability: $e');
      return false;
    }
  }

  /// Get available biometric types (Face ID, Touch ID, etc.)
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      print('Error getting available biometrics: $e');
      return [];
    }
  }

  /// Get human-readable name of available biometric
  static Future<String> getBiometricTypeName() async {
    final biometrics = await getAvailableBiometrics();

    if (biometrics.contains(BiometricType.face)) {
      return 'Face ID';
    } else if (biometrics.contains(BiometricType.fingerprint)) {
      return 'Touch ID';
    } else if (biometrics.contains(BiometricType.iris)) {
      return 'Iris';
    } else {
      return 'Biometric';
    }
  }

  /// Authenticate using biometrics
  static Future<bool> authenticate({
    String reason = 'Please authenticate to continue',
  }) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } on Exception catch (e) {
      print('Authentication error: $e');

      // Handle specific error codes
      if (e.toString().contains(auth_error.notAvailable)) {
        print('Biometric authentication not available');
      } else if (e.toString().contains(auth_error.notEnrolled)) {
        print('No biometrics enrolled');
      } else if (e.toString().contains(auth_error.lockedOut) ||
                 e.toString().contains(auth_error.permanentlyLockedOut)) {
        print('Biometric authentication locked out');
      }

      return false;
    }
  }

  /// Check if biometric login is enabled
  static Future<bool> isBiometricLoginEnabled() async {
    final String? enabled = await _secureStorage.read(key: _keyBiometricEnabled);
    return enabled == 'true';
  }

  /// Enable biometric login and store credentials securely
  static Future<void> enableBiometricLogin({
    required String username,
    required String password,
  }) async {
    // Require biometric authentication before enabling
    final authenticated = await authenticate(
      reason: 'Authenticate to enable biometric login',
    );

    if (!authenticated) {
      throw Exception('Biometric authentication failed');
    }

    // Store credentials securely
    await _secureStorage.write(key: _keyBiometricEnabled, value: 'true');
    await _secureStorage.write(key: _keyStoredUsername, value: username);
    await _secureStorage.write(key: _keyStoredPassword, value: password);

    print('✅ Biometric login enabled');
  }

  /// Disable biometric login and remove stored credentials
  static Future<void> disableBiometricLogin() async {
    await _secureStorage.delete(key: _keyBiometricEnabled);
    await _secureStorage.delete(key: _keyStoredUsername);
    await _secureStorage.delete(key: _keyStoredPassword);

    print('🔓 Biometric login disabled');
  }

  /// Get stored credentials after biometric authentication
  static Future<Map<String, String>?> getStoredCredentials() async {
    // Check if biometric login is enabled
    final bool enabled = await isBiometricLoginEnabled();
    if (!enabled) {
      return null;
    }

    // Require biometric authentication
    final biometricName = await getBiometricTypeName();
    final authenticated = await authenticate(
      reason: 'Use $biometricName to sign in',
    );

    if (!authenticated) {
      return null;
    }

    // Retrieve stored credentials
    final username = await _secureStorage.read(key: _keyStoredUsername);
    final password = await _secureStorage.read(key: _keyStoredPassword);

    if (username != null && password != null) {
      return {
        'username': username,
        'password': password,
      };
    }

    return null;
  }

  /// Check if user has stored credentials (for showing biometric button)
  static Future<bool> hasStoredCredentials() async {
    return await isBiometricLoginEnabled();
  }
}
