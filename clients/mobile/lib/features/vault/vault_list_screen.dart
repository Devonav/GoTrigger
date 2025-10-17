import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../shared/models/credential.dart';
import '../../services/api_service.dart';
import '../../services/websocket_service.dart';

class VaultListScreen extends StatefulWidget {
  const VaultListScreen({super.key});

  @override
  State<VaultListScreen> createState() => _VaultListScreenState();
}

class _VaultListScreenState extends State<VaultListScreen> {
  final _searchController = TextEditingController();
  final _wsService = WebSocketService();
  List<Credential> _credentials = [];
  List<Credential> _filteredCredentials = [];
  bool _isLoading = true;
  StreamSubscription? _syncSubscription;

  @override
  void initState() {
    super.initState();
    _loadCredentials();
    _connectWebSocket();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _syncSubscription?.cancel();
    _wsService.dispose();
    super.dispose();
  }

  /// Connect to WebSocket for real-time sync notifications
  Future<void> _connectWebSocket() async {
    try {
      await _wsService.connect(zone: 'default');

      // Listen for sync events
      _syncSubscription = _wsService.syncEvents.listen((event) {
        debugPrint('📥 Sync event received: ${event.type}');

        // Auto-refresh credentials when changes detected
        if (event.type == 'credentials_changed') {
          debugPrint('🔄 Auto-refreshing credentials due to sync event');
          _loadCredentials();

          // Show snackbar notification
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Credentials synced from another device'),
                duration: Duration(seconds: 2),
                backgroundColor: Colors.blue,
              ),
            );
          }
        }
      });
    } catch (e) {
      debugPrint('❌ WebSocket connection error: $e');
      // Continue without WebSocket - manual sync still works
    }
  }

  Future<void> _loadCredentials() async {
    setState(() => _isLoading = true);

    try {
      // Pull sync from server
      final syncData = await ApiService.pullSync(zone: 'default', lastGenCount: 0);

      // Parse credentials from sync data
      final List<dynamic> credentialMetadata = syncData['credential_metadata'] ?? [];
      final List<dynamic> syncRecords = syncData['sync_records'] ?? [];
      final List<dynamic> cryptoKeys = syncData['keys'] ?? [];

      print('📊 Sync Data Summary:');
      print('   Total metadata entries: ${credentialMetadata.length}');
      print('   Total sync records: ${syncRecords.length}');
      print('   Total crypto keys: ${cryptoKeys.length}');

      // Build credentials from metadata and sync records
      final credentials = <Credential>[];

      for (var metadata in credentialMetadata) {
        // Skip tombstoned (deleted) credentials
        if (metadata['tombstone'] == true) {
          print('⛔ Skipping tombstoned credential: ${metadata['item_uuid']}');
          continue;
        }

        // Find corresponding sync record (encrypted blob)
        final syncRecord = syncRecords.firstWhere(
          (record) => record['item_uuid'] == metadata['item_uuid'] && record['tombstone'] != true,
          orElse: () => null,
        );

        if (syncRecord == null) {
          print('⚠️  No sync record found for: ${metadata['item_uuid']} (${metadata['label']})');
          continue;
        }

        print('✅ Adding credential: ${metadata['label']} (${metadata['account']}@${metadata['server']})');

        // For now, create credentials with encrypted password placeholder
        // TODO: Implement full decryption with master key
        final credential = Credential(
          id: metadata['item_uuid'],
          url: metadata['server'] ?? '',
          username: metadata['account'] ?? '',
          password: '••••••••', // Encrypted - need master key to decrypt
          name: metadata['label'],
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );

        credentials.add(credential);
      }

      print('📱 Total credentials loaded: ${credentials.length}');

      setState(() {
        _credentials = credentials;
        _filteredCredentials = credentials;
        _isLoading = false;
      });
    } catch (e) {
      print('❌ Error loading credentials: $e');
      setState(() => _isLoading = false);

      // Check if it's an auth error (token expired)
      if (e.toString().contains('401') || e.toString().contains('Unauthorized') ||
          e.toString().contains('expired') || e.toString().contains('invalid credentials')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Session expired. Please login again.'),
              backgroundColor: Colors.orange,
            ),
          );
          // Logout and redirect to home
          await ApiService.logout();
          Navigator.of(context).pushReplacementNamed('/');
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load credentials: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _filterCredentials(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredCredentials = _credentials;
      } else {
        _filteredCredentials = _credentials.where((credential) {
          return credential.displayName.toLowerCase().contains(query.toLowerCase()) ||
              credential.username.toLowerCase().contains(query.toLowerCase()) ||
              credential.url.toLowerCase().contains(query.toLowerCase());
        }).toList();
      }
    });
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied to clipboard')),
    );
  }

  void _showDeleteAllConfirmation() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete All Credentials'),
        content: const Text(
          'Are you sure you want to delete ALL credentials from the server?\n\n'
          'This will mark all credentials as deleted on the server. '
          'This action affects all devices synced to your account.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              _deleteAllCredentials();
            },
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('Delete All'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteAllCredentials() async {
    try {
      // Call server endpoint to mark all credentials as tombstoned
      final result = await ApiService.deleteAllCredentials(zone: 'default');

      print('🗑️  Server response: ${result['deleted']} credentials deleted, gencount: ${result['gencount']}');

      // Clear local state
      setState(() {
        _credentials.clear();
        _filteredCredentials.clear();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('All credentials deleted (${result['deleted']} items)'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      print('❌ Error deleting credentials: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to delete credentials: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Password Vault'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: _loadCredentials,
            tooltip: 'Sync',
          ),
          PopupMenuButton(
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings),
                    SizedBox(width: 8),
                    Text('Settings'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'delete_all',
                child: Row(
                  children: [
                    Icon(Icons.delete_sweep, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Delete All Credentials', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout),
                    SizedBox(width: 8),
                    Text('Logout'),
                  ],
                ),
              ),
            ],
            onSelected: (value) {
              if (value == 'logout') {
                Navigator.of(context).pushReplacementNamed('/');
              } else if (value == 'delete_all') {
                _showDeleteAllConfirmation();
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search credentials...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: _filterCredentials,
            ),
          ),

          // Credentials List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredCredentials.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.lock_open,
                              size: 80,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _searchController.text.isEmpty
                                  ? 'No credentials yet'
                                  : 'No results found',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _searchController.text.isEmpty
                                  ? 'Tap + to add your first password'
                                  : 'Try a different search term',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadCredentials,
                        child: ListView.builder(
                          itemCount: _filteredCredentials.length,
                          itemBuilder: (context, index) {
                            final credential = _filteredCredentials[index];
                            return _CredentialCard(
                              credential: credential,
                              onCopyUsername: () => _copyToClipboard(
                                credential.username,
                                'Username',
                              ),
                              onCopyPassword: () => _copyToClipboard(
                                credential.password,
                                'Password',
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Navigate to add credential screen
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Add credential coming soon!')),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _CredentialCard extends StatelessWidget {
  final Credential credential;
  final VoidCallback onCopyUsername;
  final VoidCallback onCopyPassword;

  const _CredentialCard({
    required this.credential,
    required this.onCopyUsername,
    required this.onCopyPassword,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        leading: CircleAvatar(
          child: Text(
            credential.displayName[0].toUpperCase(),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(
          credential.displayName,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(credential.username),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            PopupMenuItem(
              value: 'copy-username',
              onTap: onCopyUsername,
              child: const Row(
                children: [
                  Icon(Icons.person),
                  SizedBox(width: 8),
                  Text('Copy Username'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'copy-password',
              onTap: onCopyPassword,
              child: const Row(
                children: [
                  Icon(Icons.password),
                  SizedBox(width: 8),
                  Text('Copy Password'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'edit',
              child: Row(
                children: [
                  Icon(Icons.edit),
                  SizedBox(width: 8),
                  Text('Edit'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete, color: Colors.red),
                  SizedBox(width: 8),
                  Text('Delete', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
          onSelected: (value) {
            if (value == 'edit') {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Edit coming soon!')),
              );
            } else if (value == 'delete') {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Delete coming soon!')),
              );
            }
          },
        ),
        onTap: () {
          // TODO: Navigate to credential detail screen
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Credential details coming soon!')),
          );
        },
      ),
    );
  }
}
