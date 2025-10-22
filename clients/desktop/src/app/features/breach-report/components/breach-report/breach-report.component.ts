import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BreachService, LeakResponse } from '../../services/breach.service';

@Component({
  selector: 'app-breach-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './breach-report.component.html',
  styleUrls: ['./breach-report.component.scss']
})
export class BreachReportComponent {
  email = '';
  isLoading = signal(false);
  isCVELoading = signal(false);
  errorMessage = signal('');
  leakResult = signal<LeakResponse | null>(null);
  hasChecked = signal(false);
  hasCVEData = signal(false);

  constructor(
    private breachService: BreachService,
    private router: Router
  ) {}

  checkEmail(): void {
    if (!this.email.trim()) {
      this.errorMessage.set('Please enter an email address');
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage.set('Please enter a valid email address');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.hasChecked.set(false);
    this.hasCVEData.set(false);

    this.breachService.checkEmail(this.email).subscribe({
      next: (result) => {
        this.leakResult.set(result);
        this.hasChecked.set(true);
        this.isLoading.set(false);
        // Check if CVE data already exists
        this.checkIfHasCVEData(result);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.error?.error || 'Failed to check email. Please try again.');
        console.error('Breach check error:', error);
      }
    });
  }

  checkCVERisk(): void {
    if (!this.email) return;

    this.isCVELoading.set(true);
    this.errorMessage.set('');

    this.breachService.enrichWithCVE(this.email).subscribe({
      next: (result) => {
        this.leakResult.set(result);
        this.hasCVEData.set(true);
        this.isCVELoading.set(false);
      },
      error: (error) => {
        this.isCVELoading.set(false);
        this.errorMessage.set(error.error?.error || 'Failed to fetch CVE data. Please try again.');
        console.error('CVE enrichment error:', error);
      }
    });
  }

  private checkIfHasCVEData(result: LeakResponse): void {
    // Check if any breach has CVE data
    const hasCVE = result.leaked_data?.some(leak =>
      leak.cve_data && leak.cve_data.highest_level !== 'NONE'
    );
    this.hasCVEData.set(hasCVE || false);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  reset(): void {
    this.email = '';
    this.leakResult.set(null);
    this.hasChecked.set(false);
    this.errorMessage.set('');
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  getCVESeverityColor(severity: string): string {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return '#dc2626'; // Red
      case 'HIGH':
        return '#ea580c'; // Orange
      case 'MEDIUM':
        return '#fbbf24'; // Yellow
      case 'LOW':
        return '#22c55e'; // Green
      default:
        return 'rgba(255, 255, 255, 0.4)'; // Gray
    }
  }

  getCVESeverityIcon(severity: string): string {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return '🔴';
      case 'HIGH':
        return '🟠';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
