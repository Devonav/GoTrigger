import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/import_service.dart';
import '../../services/vault_service.dart';

class ImportScreen extends StatefulWidget {
  const ImportScreen({super.key});

  @override
  State<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends State<ImportScreen> {
  String _selectedFormat = 'generic-csv';
  File? _selectedFile;
  bool _isImporting = false;
  ImportResult? _importResult;
  bool _showResult = false;

  final List<ImportFormat> _formats = ImportService.getSupportedFormats();

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv', 'json'],
      );

      if (result != null && result.files.single.path != null) {
        setState(() {
          _selectedFile = File(result.files.single.path!);
          _importResult = null;
          _showResult = false;
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error picking file: $e')),
      );
    }
  }

  Future<void> _importFile() async {
    if (_selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a file first')),
      );
      return;
    }

    setState(() {
      _isImporting = true;
      _importResult = null;
      _showResult = false;
    });

    try {
      // Validate file size (max 10MB)
      final fileSize = await _selectedFile!.length();
      if (fileSize > 10 * 1024 * 1024) {
        throw Exception('File too large (max 10MB)');
      }

      // Read file content
      final content = await _selectedFile!.readAsString();

      // Parse credentials
      final credentials = await ImportService.parseContent(content, _selectedFormat);

      if (credentials.isEmpty) {
        setState(() {
          _importResult = ImportResult(
            success: false,
            imported: 0,
            failed: 0,
            skipped: 0,
            errors: ['No valid credentials found in file'],
          );
          _showResult = true;
          _isImporting = false;
        });
        return;
      }

      // Import credentials
      int imported = 0;
      int failed = 0;
      int skipped = 0;
      List<String> errors = [];

      for (var i = 0; i < credentials.length; i++) {
        final cred = credentials[i];
        final rowNum = i + 2; // +2 because header is row 1

        try {
          // Validate required fields
          if (cred.url.isEmpty || cred.username.isEmpty || cred.password.isEmpty) {
            skipped++;
            errors.add('Row $rowNum: Missing required fields');
            continue;
          }

          // Add credential using VaultService (encrypts and syncs to server)
          await VaultService.addCredential(
            url: cred.url,
            username: cred.username,
            password: cred.password,
            notes: cred.notes,
          );

          print('✅ Imported: ${cred.name ?? cred.url} - ${cred.username}');
          imported++;
        } catch (e) {
          failed++;
          errors.add('Row $rowNum: ${e.toString()}');
        }
      }

      setState(() {
        _importResult = ImportResult(
          success: imported > 0,
          imported: imported,
          failed: failed,
          skipped: skipped,
          errors: errors,
        );
        _showResult = true;
        _isImporting = false;
      });

      if (imported > 0 && mounted) {
        // Show success and navigate back
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully imported $imported credentials'),
            backgroundColor: Colors.green,
          ),
        );

        // Wait a moment before navigating back
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) {
          Navigator.pop(context, true); // Return true to indicate success
        }
      }
    } catch (e) {
      setState(() {
        _importResult = ImportResult(
          success: false,
          imported: 0,
          failed: 0,
          skipped: 0,
          errors: [e.toString()],
        );
        _showResult = true;
        _isImporting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Import Passwords'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Info card
            Card(
              color: Colors.blue.withOpacity(0.1),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.blue[700]),
                        const SizedBox(width: 8),
                        Text(
                          'Import Information',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.blue[700],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Import credentials from other password managers. '
                      'Supported formats: CSV and JSON files from popular password managers.',
                      style: TextStyle(color: Colors.grey[700]),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Format selector
            Text(
              'Select Format',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedFormat,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                prefixIcon: const Icon(Icons.format_list_bulleted),
              ),
              items: _formats.map((format) {
                return DropdownMenuItem(
                  value: format.id,
                  child: Text(format.name),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedFormat = value ?? 'generic-csv';
                });
              },
            ),
            const SizedBox(height: 8),
            Text(
              _formats.firstWhere((f) => f.id == _selectedFormat).description,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),

            // File picker
            Text(
              'Select File',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _isImporting ? null : _pickFile,
              icon: const Icon(Icons.attach_file),
              label: Text(
                _selectedFile != null
                    ? _selectedFile!.path.split('/').last
                    : 'Choose CSV or JSON file',
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
            ),
            const SizedBox(height: 24),

            // Import button
            ElevatedButton.icon(
              onPressed: _selectedFile != null && !_isImporting ? _importFile : null,
              icon: _isImporting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.upload),
              label: Text(_isImporting ? 'Importing...' : 'Import'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
            ),

            // Results
            if (_showResult && _importResult != null) ...[
              const SizedBox(height: 24),
              Card(
                color: _importResult!.success
                    ? Colors.green.withOpacity(0.1)
                    : Colors.red.withOpacity(0.1),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            _importResult!.success ? Icons.check_circle : Icons.error,
                            color: _importResult!.success ? Colors.green : Colors.red,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _importResult!.success ? 'Import Complete' : 'Import Failed',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: _importResult!.success ? Colors.green[700] : Colors.red[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildResultRow('Imported', _importResult!.imported, Colors.green),
                      _buildResultRow('Failed', _importResult!.failed, Colors.red),
                      _buildResultRow('Skipped', _importResult!.skipped, Colors.orange),
                      if (_importResult!.errors.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Divider(),
                        const SizedBox(height: 8),
                        Text(
                          'Errors',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.red[700],
                          ),
                        ),
                        const SizedBox(height: 8),
                        ..._importResult!.errors.take(5).map((error) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text(
                                '• $error',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[700],
                                ),
                              ),
                            )),
                        if (_importResult!.errors.length > 5)
                          Text(
                            '... and ${_importResult!.errors.length - 5} more errors',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              count.toString(),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
