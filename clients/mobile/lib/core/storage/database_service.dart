import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../../shared/models/credential.dart';

/// Database Service - Handles local SQLite storage for credentials
/// Stores encrypted credentials locally for offline access
class DatabaseService {
  static Database? _database;
  static const String _dbName = 'password_sync.db';
  static const int _dbVersion = 1;

  // Table names
  static const String _credentialsTable = 'credentials';
  static const String _metadataTable = 'metadata';

  /// Get database instance (singleton pattern)
  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  /// Initialize database
  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  /// Create database tables
  static Future<void> _onCreate(Database db, int version) async {
    // Credentials table - stores encrypted credentials
    await db.execute('''
      CREATE TABLE $_credentialsTable (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        encrypted_notes TEXT,
        name TEXT,
        folder TEXT,
        totp TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0
      )
    ''');

    // Metadata table - stores vault encryption keys and settings
    await db.execute('''
      CREATE TABLE $_metadataTable (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    // Create indexes for faster queries
    await db.execute('''
      CREATE INDEX idx_credentials_url ON $_credentialsTable(url)
    ''');
    await db.execute('''
      CREATE INDEX idx_credentials_deleted ON $_credentialsTable(deleted)
    ''');
  }

  /// Handle database upgrades
  static Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle migrations in future versions
  }

  /// Insert credential
  static Future<void> insertCredential(Credential credential, String encryptedPassword, {String? encryptedNotes}) async {
    final db = await database;
    await db.insert(
      _credentialsTable,
      {
        'id': credential.id,
        'url': credential.url,
        'username': credential.username,
        'encrypted_password': encryptedPassword,
        'encrypted_notes': encryptedNotes,
        'name': credential.name,
        'folder': credential.folder,
        'totp': credential.totp,
        'created_at': credential.createdAt.toIso8601String(),
        'updated_at': credential.updatedAt.toIso8601String(),
        'deleted': credential.deleted ? 1 : 0,
        'synced': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get all credentials (not deleted)
  static Future<List<Map<String, dynamic>>> getAllCredentials() async {
    final db = await database;
    return await db.query(
      _credentialsTable,
      where: 'deleted = ?',
      whereArgs: [0],
      orderBy: 'updated_at DESC',
    );
  }

  /// Get credential by ID
  static Future<Map<String, dynamic>?> getCredentialById(String id) async {
    final db = await database;
    final results = await db.query(
      _credentialsTable,
      where: 'id = ? AND deleted = ?',
      whereArgs: [id, 0],
      limit: 1,
    );
    return results.isNotEmpty ? results.first : null;
  }

  /// Search credentials by URL or username
  static Future<List<Map<String, dynamic>>> searchCredentials(String query) async {
    final db = await database;
    return await db.query(
      _credentialsTable,
      where: 'deleted = ? AND (url LIKE ? OR username LIKE ? OR name LIKE ?)',
      whereArgs: [0, '%$query%', '%$query%', '%$query%'],
      orderBy: 'updated_at DESC',
    );
  }

  /// Update credential
  static Future<void> updateCredential(String id, Map<String, dynamic> updates) async {
    final db = await database;
    await db.update(
      _credentialsTable,
      {
        ...updates,
        'updated_at': DateTime.now().toIso8601String(),
        'synced': 0,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Soft delete credential
  static Future<void> deleteCredential(String id) async {
    final db = await database;
    await db.update(
      _credentialsTable,
      {
        'deleted': 1,
        'updated_at': DateTime.now().toIso8601String(),
        'synced': 0,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Hard delete credential (permanent)
  static Future<void> permanentlyDeleteCredential(String id) async {
    final db = await database;
    await db.delete(
      _credentialsTable,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Get unsynced credentials
  static Future<List<Map<String, dynamic>>> getUnsyncedCredentials() async {
    final db = await database;
    return await db.query(
      _credentialsTable,
      where: 'synced = ?',
      whereArgs: [0],
    );
  }

  /// Mark credentials as synced
  static Future<void> markAsSynced(List<String> ids) async {
    final db = await database;
    await db.update(
      _credentialsTable,
      {'synced': 1},
      where: 'id IN (${ids.map((_) => '?').join(', ')})',
      whereArgs: ids,
    );
  }

  /// Save metadata (e.g., encrypted vault key, salt)
  static Future<void> saveMetadata(String key, String value) async {
    final db = await database;
    await db.insert(
      _metadataTable,
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get metadata
  static Future<String?> getMetadata(String key) async {
    final db = await database;
    final results = await db.query(
      _metadataTable,
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    return results.isNotEmpty ? results.first['value'] as String : null;
  }

  /// Delete metadata
  static Future<void> deleteMetadata(String key) async {
    final db = await database;
    await db.delete(
      _metadataTable,
      where: 'key = ?',
      whereArgs: [key],
    );
  }

  /// Clear all data (logout/reset)
  static Future<void> clearAll() async {
    final db = await database;
    await db.delete(_credentialsTable);
    await db.delete(_metadataTable);
  }

  /// Close database
  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
