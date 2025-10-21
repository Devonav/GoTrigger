import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { SessionStorageService } from '@core/storage/session-storage.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  userEmail = signal('');

  constructor(
    private router: Router,
    private authService: AuthService,
    private sessionStorage: SessionStorageService
  ) {
    const email = this.sessionStorage.getEmail();
    if (email) {
      this.userEmail.set(email);
    }
  }

  navigateToVault(): void {
    this.router.navigate(['/vault/unlock']);
  }

  navigateToMailSync(): void {
    // Coming soon
    alert('Mail Sync - Coming Soon');
  }

  navigateToBreachReport(): void {
    this.router.navigate(['/breach-report']);
  }

  navigateToCVEAlerts(): void {
    // Coming soon
    alert('CVE Security Alerts - Coming Soon');
  }

  navigateToPasswordRotation(): void {
    // Coming soon
    alert('Password Rotation - Coming Soon');
  }

  navigateToSettings(): void {
    // Coming soon
    alert('Settings - Coming Soon');
  }

  async logout(): Promise<void> {
    this.authService.logout();
    this.sessionStorage.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
