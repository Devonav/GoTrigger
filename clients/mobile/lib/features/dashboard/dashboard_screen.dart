import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _userEmail = '';

  @override
  void initState() {
    super.initState();
    _loadUserEmail();
  }

  Future<void> _loadUserEmail() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userEmail = prefs.getString('email') ?? '';
    });
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();

    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
  }

  void _navigateToVault() {
    Navigator.pushNamed(context, '/vault');
  }

  void _navigateToBreachReport() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Breach Report - Coming Soon')),
    );
  }

  void _navigateToCVEAlerts() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('CVE Security Alerts - Coming Soon')),
    );
  }

  void _navigateToPasswordRotation() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Password Rotation - Coming Soon')),
    );
  }

  void _navigateToSettings() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Settings - Coming Soon')),
    );
  }

  void _navigateToMailSync() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Mail Sync - Coming Soon')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFF0F0F0F), // Mobile-friendly dark gray
      appBar: AppBar(
        title: const Text(
          'Dashboard',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: const Color(0xFF1A1A1A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
            tooltip: 'Logout',
            style: IconButton.styleFrom(
              foregroundColor: Colors.white.withOpacity(0.6),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Section
              _buildWelcomeSection(colorScheme),
              const SizedBox(height: 32),

              // Dashboard Tiles
              _buildDashboardTiles(colorScheme),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeSection(ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
          width: 1.5,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Welcome back',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              letterSpacing: -0.02,
            ),
          ),
          if (_userEmail.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _userEmail,
              style: TextStyle(
                fontSize: 13,
                color: Colors.white.withOpacity(0.5),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDashboardTiles(ColorScheme colorScheme) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: 0.85,
      children: [
        _buildDashboardTile(
          context: context,
          icon: Icons.lock,
          title: 'Password Vault',
          subtitle: 'Manage passwords',
          color: const Color(0xFF667EEA), // Indigo - matches desktop
          onTap: _navigateToVault,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.email,
          title: 'Mail Sync',
          subtitle: 'Coming Soon',
          color: const Color(0xFF4FACFE), // Sky Blue - matches desktop
          onTap: _navigateToMailSync,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.warning_amber,
          title: 'Breach Report',
          subtitle: 'Check credentials',
          color: const Color(0xFFFBBF24), // Amber/Gold - matches desktop
          onTap: _navigateToBreachReport,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.shield,
          title: 'CVE Alerts',
          subtitle: 'Security alerts',
          color: const Color(0xFFEF4444), // Red - matches desktop
          onTap: _navigateToCVEAlerts,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.refresh,
          title: 'Password Rotation',
          subtitle: 'Auto-update',
          color: const Color(0xFF22C55E), // Green - matches desktop
          onTap: _navigateToPasswordRotation,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.settings,
          title: 'Settings',
          subtitle: 'Preferences',
          color: const Color(0xFFA855F7), // Purple - matches desktop
          onTap: _navigateToSettings,
        ),
      ],
    );
  }

  Widget _buildDashboardTile({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        border: Border.all(
          color: Colors.white.withOpacity(0.12),
          width: 1.5,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          splashColor: color.withOpacity(0.1),
          highlightColor: color.withOpacity(0.05),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 48,
                  color: color,
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    letterSpacing: -0.01,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withOpacity(0.5),
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
