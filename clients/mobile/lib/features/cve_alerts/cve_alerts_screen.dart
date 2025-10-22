import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'package:intl/intl.dart';

class CveAlertsScreen extends StatefulWidget {
  const CveAlertsScreen({super.key});

  @override
  State<CveAlertsScreen> createState() => _CveAlertsScreenState();
}

class _CveAlertsScreenState extends State<CveAlertsScreen> {
  final _keywordController = TextEditingController();
  bool _isLoading = false;
  String _errorMessage = '';
  Map<String, dynamic>? _cveResult;
  bool _hasSearched = false;
  bool _showLatest = true;

  @override
  void initState() {
    super.initState();
    _loadLatestCVEs();
  }

  @override
  void dispose() {
    _keywordController.dispose();
    super.dispose();
  }

  Future<void> _loadLatestCVEs() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _hasSearched = false;
      _showLatest = true;
      _keywordController.clear();
    });

    try {
      final result = await ApiService.getLatestCVEs(limit: 20);
      setState(() {
        _cveResult = result;
        _hasSearched = true;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load CVEs. Please try again.';
      });
      debugPrint('CVE fetch error: $e');
    }
  }

  Future<void> _searchCVEs() async {
    final keyword = _keywordController.text.trim();

    if (keyword.isEmpty) {
      setState(() => _errorMessage = 'Please enter a company or product name');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _hasSearched = false;
      _showLatest = false;
    });

    try {
      final result = await ApiService.searchCVEs(keyword: keyword, limit: 20);
      setState(() {
        _cveResult = result;
        _hasSearched = true;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to search CVEs. Please try again.';
      });
      debugPrint('CVE search error: $e');
    }
  }

  void _reset() {
    _loadLatestCVEs();
  }

  String _getCVEDescription(Map<String, dynamic> cve) {
    final cveData = cve['cve'] as Map<String, dynamic>?;
    if (cveData == null) return 'No description available';

    final descriptions = cveData['descriptions'] as List<dynamic>? ?? [];
    final enDesc = descriptions.firstWhere(
      (d) => d['lang'] == 'en',
      orElse: () => {'value': 'No description available'},
    );
    return enDesc['value'] ?? 'No description available';
  }

  String _getCVESeverity(Map<String, dynamic> cve) {
    final cveData = cve['cve'] as Map<String, dynamic>?;
    if (cveData == null) return 'UNKNOWN';

    final metrics = cveData['metrics'] as Map<String, dynamic>?;
    if (metrics == null) return 'UNKNOWN';

    final cvssMetrics = metrics['cvssMetricV31'] as List<dynamic>? ?? [];
    if (cvssMetrics.isEmpty) return 'UNKNOWN';

    final metric = cvssMetrics[0] as Map<String, dynamic>;
    final cvssV3 = metric['cvssV3'] as Map<String, dynamic>?;
    return cvssV3?['baseSeverity'] ?? 'UNKNOWN';
  }

  double _getCVEScore(Map<String, dynamic> cve) {
    final cveData = cve['cve'] as Map<String, dynamic>?;
    if (cveData == null) return 0.0;

    final metrics = cveData['metrics'] as Map<String, dynamic>?;
    if (metrics == null) return 0.0;

    final cvssMetrics = metrics['cvssMetricV31'] as List<dynamic>? ?? [];
    if (cvssMetrics.isEmpty) return 0.0;

    final metric = cvssMetrics[0] as Map<String, dynamic>;
    final cvssV3 = metric['cvssV3'] as Map<String, dynamic>?;
    return (cvssV3?['baseScore'] as num?)?.toDouble() ?? 0.0;
  }

  Color _getSeverityColor(String severity) {
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

  String _formatDate(String dateString) {
    try {
      final date = DateTime.parse(dateString);
      return DateFormat('MMM d, yyyy').format(date);
    } catch (e) {
      return dateString;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CVE Security Alerts'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _reset,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                TextField(
                  controller: _keywordController,
                  decoration: InputDecoration(
                    hintText: 'Search company or product (e.g., Apple, Chrome)',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                  ),
                  onSubmitted: (_) => _searchCVEs(),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : _searchCVEs,
                        icon: const Icon(Icons.search),
                        label: const Text('Search'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _isLoading ? null : _reset,
                        icon: const Icon(Icons.auto_awesome),
                        label: const Text('Latest'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Error message
          if (_errorMessage.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Results
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _hasSearched && _cveResult != null
                    ? _buildResults()
                    : const Center(
                        child: Text('Search for CVEs or view latest'),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildResults() {
    final vulnerabilities = _cveResult!['vulnerabilities'] as List<dynamic>? ?? [];
    final totalResults = _cveResult!['totalResults'] as int? ?? 0;

    if (vulnerabilities.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No CVEs found',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Try a different search term',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            _showLatest
                ? 'Latest CVEs ($totalResults total)'
                : 'Search Results ($totalResults total)',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            itemCount: vulnerabilities.length,
            itemBuilder: (context, index) {
              final cve = vulnerabilities[index];
              return _buildCVECard(cve);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCVECard(Map<String, dynamic> cve) {
    final cveData = cve['cve'] as Map<String, dynamic>?;
    if (cveData == null) return const SizedBox.shrink();

    final cveId = cveData['id'] as String? ?? 'Unknown';
    final description = _getCVEDescription(cve);
    final severity = _getCVESeverity(cve);
    final score = _getCVEScore(cve);
    final published = cveData['published'] as String? ?? '';
    final severityColor = _getSeverityColor(severity);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // CVE ID and severity badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    cveId,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: severityColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    severity.toUpperCase(),
                    style: TextStyle(
                      color: severityColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Score
            Row(
              children: [
                Icon(Icons.speed, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  'Score: ${score.toStringAsFixed(1)}',
                  style: TextStyle(
                    color: severityColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 16),
                Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  _formatDate(published),
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Description
            Text(
              description,
              style: TextStyle(color: Colors.grey[700]),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
