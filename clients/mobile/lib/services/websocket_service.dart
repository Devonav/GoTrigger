import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/environment.dart';

/// SyncEvent model matching the server
class SyncEvent {
  final String type;
  final String userId;
  final String zone;
  final int genCount;
  final int timestamp;

  SyncEvent({
    required this.type,
    required this.userId,
    required this.zone,
    required this.genCount,
    required this.timestamp,
  });

  factory SyncEvent.fromJson(Map<String, dynamic> json) {
    return SyncEvent(
      type: json['type'] as String,
      userId: json['user_id'] as String,
      zone: json['zone'] as String,
      genCount: json['gencount'] as int,
      timestamp: json['timestamp'] as int,
    );
  }
}

/// WebSocket Service - Handles real-time sync notifications
class WebSocketService {
  static final String _baseWsUrl = Environment.wsUrl;
  static final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  WebSocketChannel? _channel;
  final StreamController<SyncEvent> _syncEventController = StreamController<SyncEvent>.broadcast();
  bool _isConnected = false;
  Timer? _reconnectTimer;
  String? _currentZone;

  /// Stream of sync events
  Stream<SyncEvent> get syncEvents => _syncEventController.stream;

  /// Check if WebSocket is connected
  bool get isConnected => _isConnected;

  /// Connect to WebSocket endpoint
  Future<void> connect({String zone = 'default'}) async {
    if (_isConnected) {
      debugPrint('🔌 WebSocket already connected');
      return;
    }

    try {
      // Get access token
      final token = await _secureStorage.read(key: 'access_token');
      if (token == null) {
        throw Exception('No access token found');
      }

      _currentZone = zone;

      // Create WebSocket connection with Authorization header in URL
      // Pass token as query parameter since web_socket_channel 3.0 doesn't support headers in connect()
      final wsUrl = '$_baseWsUrl/sync/live?zone=$zone&token=$token';
      _channel = WebSocketChannel.connect(
        Uri.parse(wsUrl),
      );

      _isConnected = true;
      debugPrint('✅ WebSocket connected: zone=$zone');

      // Listen for messages
      _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String);
            final event = SyncEvent.fromJson(data);
            debugPrint('📥 Received sync event: type=${event.type}, gencount=${event.genCount}');
            _syncEventController.add(event);
          } catch (e) {
            debugPrint('❌ Error parsing sync event: $e');
          }
        },
        onError: (error) {
          debugPrint('❌ WebSocket error: $error');
          _handleDisconnect();
        },
        onDone: () {
          debugPrint('🔌 WebSocket disconnected');
          _handleDisconnect();
        },
      );
    } catch (e) {
      debugPrint('❌ WebSocket connection error: $e');
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  /// Disconnect from WebSocket
  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    if (_channel != null) {
      await _channel!.sink.close();
      _channel = null;
    }

    _isConnected = false;
    _currentZone = null;
    debugPrint('🔌 WebSocket disconnected');
  }

  /// Handle disconnection and schedule reconnect
  void _handleDisconnect() {
    _isConnected = false;
    _channel = null;
    _scheduleReconnect();
  }

  /// Schedule reconnection attempt
  void _scheduleReconnect() {
    if (_reconnectTimer != null || _currentZone == null) {
      return;
    }

    debugPrint('⏱️ Scheduling WebSocket reconnect in 5 seconds...');
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      _reconnectTimer = null;
      if (_currentZone != null) {
        debugPrint('🔄 Attempting WebSocket reconnect...');
        connect(zone: _currentZone!);
      }
    });
  }

  /// Dispose service
  void dispose() {
    disconnect();
    _syncEventController.close();
  }
}
