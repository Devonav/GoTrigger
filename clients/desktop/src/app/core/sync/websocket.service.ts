import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export interface SyncEvent {
  type: string;
  user_id: string;
  zone: string;
  gencount: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private syncEventSubject = new Subject<SyncEvent>();
  private reconnectTimeout: any = null;
  private isConnected = false;
  private currentZone: string | null = null;
  private readonly WS_URL = 'ws://localhost:8080/api/v1/sync/live';
  private readonly RECONNECT_DELAY = 5000;

  constructor(private authService: AuthService) {}

  /**
   * Connect to WebSocket endpoint
   */
  connect(zone: string = 'default'): void {
    if (this.isConnected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      console.error('❌ No auth token found for WebSocket connection');
      return;
    }

    try {
      this.currentZone = zone;
      // Pass token as query parameter for authentication
      const wsUrl = `${this.WS_URL}?zone=${zone}&token=${token}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected:', zone);
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const syncEvent: SyncEvent = JSON.parse(event.data);
          console.log('📥 Received sync event:', syncEvent.type, 'gencount:', syncEvent.gencount);
          this.syncEventSubject.next(syncEvent);
        } catch (error) {
          console.error('❌ Error parsing sync event:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.handleDisconnect();
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.currentZone = null;
    console.log('🔌 WebSocket disconnected');
  }

  /**
   * Get sync events stream
   */
  getSyncEvents(): Observable<SyncEvent> {
    return this.syncEventSubject.asObservable();
  }

  /**
   * Check if WebSocket is connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Handle disconnection and schedule reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.ws = null;
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout || !this.currentZone) {
      return;
    }

    console.log('⏱️ Scheduling WebSocket reconnect in 5 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.currentZone) {
        console.log('🔄 Attempting WebSocket reconnect...');
        this.connect(this.currentZone);
      }
    }, this.RECONNECT_DELAY);
  }
}
