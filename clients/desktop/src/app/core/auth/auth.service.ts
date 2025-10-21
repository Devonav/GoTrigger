import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getApiUrl } from '../../../environments/environment';

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_id?: string;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = getApiUrl();
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkAuthStatus();
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, {
      email,
      password
    }).pipe(
      tap(response => this.handleAuthSuccess(response))
    );
  }

  login(email: string, password: string, deviceId?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, {
      email,
      password,
      device_id: deviceId
    }).pipe(
      tap(response => this.handleAuthSuccess(response))
    );
  }

  refreshToken(refreshToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {
      refresh_token: refreshToken
    }).pipe(
      tap(response => this.handleAuthSuccess(response))
    );
  }

  logout(): void {
    this.clearSession();
    this.isAuthenticatedSubject.next(false);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  getUserId(): string | null {
    return localStorage.getItem('user_id');
  }

  getEmail(): string | null {
    return localStorage.getItem('email');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private handleAuthSuccess(response: AuthResponse): void {
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('user_id', response.user_id);
    localStorage.setItem('email', response.email);
    this.isAuthenticatedSubject.next(true);
  }

  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('email');
  }

  private checkAuthStatus(): void {
    const hasToken = this.isAuthenticated();
    this.isAuthenticatedSubject.next(hasToken);
  }
}
