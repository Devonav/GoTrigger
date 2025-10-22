import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiUrl } from '../../../../environments/environment';

export interface CVEItemSimple {
  id: string;
  description: string;
  published: string;
  score: number;
  severity: string;
}

export interface CompanyCVEData {
  total_cves: number;
  highest_score: number;
  highest_level: string; // CRITICAL/HIGH/MEDIUM/LOW/NONE
  top_cves: CVEItemSimple[];
}

export interface LeakSource {
  source: string;
  date: string;
  data_types: string[];
  description?: string;
  pwn_count?: number;
  is_verified?: boolean;
  cve_data?: CompanyCVEData; // NEW: CVE enrichment
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
  private readonly API_URL = getApiUrl();

  constructor(private http: HttpClient) {}

  checkEmail(email: string): Observable<LeakResponse> {
    return this.http.post<LeakResponse>(
      `${this.API_URL}/breach/check`,
      { email }
    );
  }

  enrichWithCVE(email: string): Observable<LeakResponse> {
    return this.http.post<LeakResponse>(
      `${this.API_URL}/breach/enrich-cve`,
      { email }
    );
  }
}
