/// Credential Model - Represents a password entry
/// Matches the desktop client's credential structure
class Credential {
  final String id;
  final String url;
  final String username;
  final String password;
  final String? notes;
  final String? name;
  final String? folder;
  final String? totp;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool deleted;

  Credential({
    required this.id,
    required this.url,
    required this.username,
    required this.password,
    this.notes,
    this.name,
    this.folder,
    this.totp,
    required this.createdAt,
    required this.updatedAt,
    this.deleted = false,
  });

  /// Create from JSON
  factory Credential.fromJson(Map<String, dynamic> json) {
    return Credential(
      id: json['id'] as String,
      url: json['url'] as String,
      username: json['username'] as String,
      password: json['password'] as String,
      notes: json['notes'] as String?,
      name: json['name'] as String?,
      folder: json['folder'] as String?,
      totp: json['totp'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      deleted: json['deleted'] as bool? ?? false,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'url': url,
      'username': username,
      'password': password,
      if (notes != null) 'notes': notes,
      if (name != null) 'name': name,
      if (folder != null) 'folder': folder,
      if (totp != null) 'totp': totp,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'deleted': deleted,
    };
  }

  /// Create a copy with updated fields
  Credential copyWith({
    String? id,
    String? url,
    String? username,
    String? password,
    String? notes,
    String? name,
    String? folder,
    String? totp,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? deleted,
  }) {
    return Credential(
      id: id ?? this.id,
      url: url ?? this.url,
      username: username ?? this.username,
      password: password ?? this.password,
      notes: notes ?? this.notes,
      name: name ?? this.name,
      folder: folder ?? this.folder,
      totp: totp ?? this.totp,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deleted: deleted ?? this.deleted,
    );
  }

  /// Extract domain from URL for display
  String get domain {
    try {
      final uri = Uri.parse(url.startsWith('http') ? url : 'https://$url');
      return uri.host.replaceAll('www.', '');
    } catch (e) {
      return url;
    }
  }

  /// Get display name (name or domain)
  String get displayName {
    if (name != null && name!.isNotEmpty) {
      return name!;
    }
    return domain;
  }

  @override
  String toString() {
    return 'Credential(id: $id, url: $url, username: $username)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;

    return other is Credential && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
