import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { SessionStorageService } from '@core/storage/session-storage.service';
import { VaultStorageService } from '@core/storage/vault-storage.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  constructor(
    private authService: AuthService,
    private sessionStorage: SessionStorageService,
    private vaultStorage: VaultStorageService,
    private router: Router
  ) {}

  async onSubmit() {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage.set('Please enter email and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.email, this.password).subscribe({
      next: async (response) => {
        this.sessionStorage.saveSession({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          userId: response.user_id,
          email: response.email
        });

        this.isLoading.set(false);
        
        try {
          await this.vaultStorage.initialize();
          const vaultInitialized = await this.vaultStorage.getConfig('vault_initialized');
          
          if (vaultInitialized === 'true') {
            this.router.navigate(['/vault/unlock']);
          } else {
            this.router.navigate(['/vault/setup']);
          }
        } catch (error) {
          console.error('Failed to check vault status:', error);
          this.router.navigate(['/vault/setup']);
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        
        if (error.status === 401) {
          this.errorMessage.set('Invalid email or password');
        } else if (error.status === 0) {
          this.errorMessage.set('Cannot connect to server. Is it running?');
        } else {
          this.errorMessage.set('Login failed. Please try again.');
        }
        
        console.error('Login error:', error);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  goToRegister() {
    this.router.navigate(['/auth/register']);
  }
}
