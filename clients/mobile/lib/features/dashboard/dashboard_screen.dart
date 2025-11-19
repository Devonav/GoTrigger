import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../breach_report/breach_report_screen.dart';
import '../cve_alerts/cve_alerts_screen.dart';
import '../../widgets/glassmorphic_container.dart';

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
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const BreachReportScreen()),
    );
  }

  void _navigateToCVEAlerts() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const CveAlertsScreen()),
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
      backgroundColor: const Color(0xFF0A0A0A),
      body: QuantumBackground(
        child: SafeArea(
          child: Column(
            children: [
              // App Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: const Color(0xFF7C3AED).withOpacity(0.2),
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    const GradientText(
                      text: 'Dashboard',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.logout, size: 22),
                      onPressed: _logout,
                      tooltip: 'Logout',
                      style: IconButton.styleFrom(
                        foregroundColor: const Color(0xFF7C3AED),
                      ),
                    ),
                  ],
                ),
              ),

              // Scrollable Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Welcome Section
                      _buildWelcomeSection(colorScheme),
                      const SizedBox(height: 24),

                      // Dashboard Tiles
                      _buildDashboardTiles(colorScheme),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeSection(ColorScheme colorScheme) {
    return GlassmorphicContainer(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const GradientText(
            text: 'Welcome back',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
          if (_userEmail.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _userEmail,
              style: TextStyle(
                fontSize: 14,
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
          color: const Color(0xFF7C3AED), // Quantum Purple
          onTap: _navigateToVault,
        ),
        _buildDashboardTile(
          context: context,
          icon: Icons.email,
          title: 'Mail Sync',
          subtitle: 'Sync and manage your email',
          color: const Color(0xFF7C3AED), // Quantum Purple
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
    return GlassmorphicContainer(
      padding: EdgeInsets.zero,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          splashColor: const Color(0xFF7C3AED).withOpacity(0.2),
          highlightColor: const Color(0xFF7C3AED).withOpacity(0.1),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: color.withOpacity(0.3),
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    icon,
                    size: 32,
                    color: color,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    letterSpacing: -0.3,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
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
