import { Injectable } from '@angular/core';

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  deviceId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {
  private readonly SESSION_KEY = 'session';

  saveSession(session: Session): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  getSession(): Session | null {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData) as Session;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  hasValidSession(): boolean {
    const session = this.getSession();
    return !!session?.accessToken;
  }

  getAccessToken(): string | null {
    return this.getSession()?.accessToken || null;
  }

  getRefreshToken(): string | null {
    return this.getSession()?.refreshToken || null;
  }

  getUserId(): string | null {
    return this.getSession()?.userId || null;
  }

  getEmail(): string | null {
    return this.getSession()?.email || null;
  }

  getDeviceId(): string | null {
    return this.getSession()?.deviceId || null;
  }
}
