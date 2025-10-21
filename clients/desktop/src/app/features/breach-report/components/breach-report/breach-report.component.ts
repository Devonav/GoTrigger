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
  errorMessage = signal('');
  leakResult = signal<LeakResponse | null>(null);
  hasChecked = signal(false);

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

    this.breachService.checkEmail(this.email).subscribe({
      next: (result) => {
        this.leakResult.set(result);
        this.hasChecked.set(true);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.error?.error || 'Failed to check email. Please try again.');
        console.error('Breach check error:', error);
      }
    });
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

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
