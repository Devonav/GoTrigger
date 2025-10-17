import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { SessionStorageService } from '@core/storage/session-storage.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor(
    private authService: AuthService,
    private sessionStorage: SessionStorageService,
    private router: Router
  ) {}

  async onSubmit() {
    this.errorMessage.set('');

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage.set('Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage.set('Please enter a valid email address');
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    this.isLoading.set(true);

    this.authService.register(this.email, this.password).subscribe({
      next: (response) => {
        this.sessionStorage.saveSession({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          userId: response.user_id,
          email: response.email
        });

        this.isLoading.set(false);
        // New users always go to setup
        this.router.navigate(['/vault/setup']);
      },
      error: (error) => {
        this.isLoading.set(false);
        
        if (error.status === 409) {
          this.errorMessage.set('An account with this email already exists');
        } else if (error.status === 0) {
          this.errorMessage.set('Cannot connect to server. Is it running?');
        } else {
          this.errorMessage.set('Registration failed. Please try again.');
        }
        
        console.error('Registration error:', error);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(v => !v);
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
