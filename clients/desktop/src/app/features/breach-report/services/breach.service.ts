import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeakSource {
  source: string;
  date: string;
  data_types: string[];
}

export interface LeakResponse {
  email: string;
  sources: string[];
  total_leaks: number;
  leaked_data: LeakSource[];
}

@Injectable({
  providedIn: 'root'
})
export class BreachService {
  private readonly API_URL = 'http://localhost:8080/api/v1';

  constructor(private http: HttpClient) {}

  checkEmail(email: string): Observable<LeakResponse> {
    return this.http.post<LeakResponse>(
      `${this.API_URL}/breach/check`,
      { email }
    );
  }
}
