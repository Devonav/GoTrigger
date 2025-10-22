import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class BreachReportScreen extends StatefulWidget {
  const BreachReportScreen({super.key});

  @override
  State<BreachReportScreen> createState() => _BreachReportScreenState();
}

class _BreachReportScreenState extends State<BreachReportScreen> {
  final _emailController = TextEditingController();
  bool _isLoading = false;
  bool _isCVELoading = false;
  String _errorMessage = '';
  Map<String, dynamic>? _leakResult;
  bool _hasChecked = false;
  bool _hasCVEData = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _checkEmail() async {
    final email = _emailController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter an email address');
      return;
    }

    if (!_isValidEmail(email)) {
      setState(() => _errorMessage = 'Please enter a valid email address');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _hasChecked = false;
      _hasCVEData = false;
    });

    try {
      final result = await ApiService.checkEmailBreach(email: email);
      setState(() {
        _leakResult = result;
        _hasChecked = true;
        _isLoading = false;
        _checkIfHasCVEData(result);
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to check email. Please try again.';
      });
      debugPrint('Breach check error: $e');
    }
  }

  Future<void> _checkCVERisk() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;

    setState(() {
      _isCVELoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.enrichWithCVE(email: email);
      setState(() {
        _leakResult = result;
        _hasCVEData = true;
        _isCVELoading = false;
      });
    } catch (e) {
      setState(() {
        _isCVELoading = false;
        _errorMessage = 'Failed to fetch CVE data. Please try again.';
      });
      debugPrint('CVE enrichment error: $e');
    }
  }

  void _checkIfHasCVEData(Map<String, dynamic> result) {
    final leakedData = result['leaked_data'] as List<dynamic>? ?? [];
    final hasCVE = leakedData.any((leak) {
      final cveData = leak['cve_data'] as Map<String, dynamic>?;
      return cveData != null && cveData['highest_level'] != 'NONE';
    });
    _hasCVEData = hasCVE;
  }

  void _reset() {
    setState(() {
      _emailController.clear();
      _leakResult = null;
      _hasChecked = false;
      _errorMessage = '';
      _hasCVEData = false;
    });
  }

  bool _isValidEmail(String email) {
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    return emailRegex.hasMatch(email);
  }

  Color _getCVESeverityColor(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return const Color(0xFFDC2626);
      case 'HIGH':
        return const Color(0xFFEA580C);
      case 'MEDIUM':
        return const Color(0xFFFBBF24);
      case 'LOW':
        return const Color(0xFF22C55E);
      default:
        return Colors.grey;
    }
  }

  String _getCVESeverityIcon(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return '🔴';
      case 'HIGH':
        return '🟠';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Breach Report'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _emailController,
              decoration: InputDecoration(
                hintText: 'Enter email address',
                prefixIcon: const Icon(Icons.email),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              keyboardType: TextInputType.emailAddress,
              onSubmitted: (_) => _checkEmail(),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _checkEmail,
              icon: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.search),
              label: Text(_isLoading ? 'Checking...' : 'Check Email'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
            ),
            if (_errorMessage.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _errorMessage,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            ],
            if (_hasChecked && _leakResult != null) ...[
              const SizedBox(height: 24),
              _buildResults(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    final totalLeaks = _leakResult!['total_leaks'] as int? ?? 0;
    final leakedData = _leakResult!['leaked_data'] as List<dynamic>? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Icon(
                  totalLeaks > 0 ? Icons.warning : Icons.check_circle,
                  size: 48,
                  color: totalLeaks > 0 ? Colors.red : Colors.green,
                ),
                const SizedBox(height: 8),
                Text(
                  totalLeaks > 0 ? 'Data Breaches Found!' : 'No Breaches Found',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  totalLeaks > 0
                      ? 'Your email was found in $totalLeaks data breach${totalLeaks > 1 ? 'es' : ''}'
                      : 'Your email has not been found in any known data breaches',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
        if (totalLeaks > 0 && !_hasCVEData) ...[
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _isCVELoading ? null : _checkCVERisk,
            icon: _isCVELoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.security),
            label: Text(_isCVELoading ? 'Analyzing...' : 'Check CVE Risk'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.all(16),
              backgroundColor: Colors.orange,
            ),
          ),
        ],
        if (leakedData.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(
            'Breach Details',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ...leakedData.map((leak) => _buildBreachCard(leak)).toList(),
        ],
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: _reset,
          child: const Text('Check Another Email'),
        ),
      ],
    );
  }

  Widget _buildBreachCard(Map<String, dynamic> leak) {
    final source = leak['source'] as String? ?? 'Unknown';
    final date = leak['date'] as String? ?? '';
    final dataTypes = leak['data_types'] as List<dynamic>? ?? [];
    final pwnCount = leak['pwn_count'] as int? ?? 0;
    final cveData = leak['cve_data'] as Map<String, dynamic>?;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    source,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                if (leak['is_verified'] == true)
                  const Icon(Icons.verified, color: Colors.blue, size: 20),
              ],
            ),
            if (date.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'Date: $date',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
            if (pwnCount > 0) ...[
              const SizedBox(height: 4),
              Text(
                'Affected accounts: ${pwnCount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (match) => '${match[1]},')}',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
            if (dataTypes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: dataTypes
                    .map((type) => Chip(
                          label: Text(
                            type.toString(),
                            style: const TextStyle(fontSize: 12),
                          ),
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
            ],
            if (cveData != null && cveData['highest_level'] != 'NONE') ...[
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              Text(
                'CVE Security Risk',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: _getCVESeverityColor(cveData['highest_level'] ?? ''),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    _getCVESeverityIcon(cveData['highest_level'] ?? ''),
                    style: const TextStyle(fontSize: 20),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${cveData['highest_level']} - Score: ${cveData['highest_score']}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: _getCVESeverityColor(cveData['highest_level'] ?? ''),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Total CVEs: ${cveData['total_cves']}',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
