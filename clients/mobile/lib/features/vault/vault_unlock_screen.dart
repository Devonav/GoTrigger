import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';

class VaultUnlockScreen extends StatefulWidget {
  const VaultUnlockScreen({super.key});

  @override
  State<VaultUnlockScreen> createState() => _VaultUnlockScreenState();
}

class _VaultUnlockScreenState extends State<VaultUnlockScreen> {
  final _passwordController = TextEditingController();
  final _localAuth = LocalAuthentication();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _biometricAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _checkBiometric() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();

      setState(() {
        _biometricAvailable = canCheck && isDeviceSupported;
      });

      // Auto-trigger biometric if available
      if (_biometricAvailable) {
        Future.delayed(const Duration(milliseconds: 500), _handleBiometricUnlock);
      }
    } catch (e) {
      debugPrint('Biometric check error: $e');
    }
  }

  Future<void> _handleBiometricUnlock() async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Unlock your password vault',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      if (authenticated && mounted) {
        // TODO: Retrieve password from secure storage and unlock vault
        Navigator.of(context).pushReplacementNamed('/vault-list');
      }
    } catch (e) {
      debugPrint('Biometric auth error: $e');
    }
  }

  Future<void> _handlePasswordUnlock() async {
    if (_passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your master password')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // TODO: Derive encryption key from password and unlock vault
      await Future.delayed(const Duration(seconds: 1)); // Simulate processing

      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/vault-list');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unlock failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Unlock Vault'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Lock Icon
              Icon(
                Icons.lock,
                size: 100,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 32),

              // Title
              Text(
                'Unlock Your Vault',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),

              // Subtitle
              Text(
                'Enter your master password to access your credentials',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // Password Field
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Master Password',
                  prefixIcon: const Icon(Icons.key),
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility : Icons.visibility_off,
                    ),
                    onPressed: () {
                      setState(() => _obscurePassword = !_obscurePassword);
                    },
                  ),
                ),
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _handlePasswordUnlock(),
              ),
              const SizedBox(height: 24),

              // Unlock Button
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isLoading ? null : _handlePasswordUnlock,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Unlock'),
                  ),
                ),
              ),

              // Biometric Unlock Button
              if (_biometricAvailable) ...[
                const SizedBox(height: 16),
                const Text(
                  'or',
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _handleBiometricUnlock,
                  icon: const Icon(Icons.fingerprint),
                  label: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16.0),
                    child: Text('Unlock with Biometric'),
                  ),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 0),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
