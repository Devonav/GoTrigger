import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VaultService } from '../../services/vault.service';
import { AuthService } from '@core/auth/auth.service';
import { SessionStorageService } from '@core/storage/session-storage.service';
import { ImportDialogComponent } from '../import-dialog/import-dialog.component';
import { ImportResult } from '../../services/import.service';

interface VaultCredential {
  uuid: string;
  server: string;
  account: string;
  data: {
    url?: string;
    username: string;
    password: string;
    notes?: string;
  };
  gencount?: number;
  created_at?: number;
  updated_at?: number;
}

@Component({
  selector: 'app-vault-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportDialogComponent],
  templateUrl: './vault-list.component.html',
  styleUrls: ['./vault-list.component.scss']
})
export class VaultListComponent implements OnInit {
  searchQuery = signal('');
  selectedCredential = signal<VaultCredential | null>(null);
  showPassword = signal<string | null>(null);
  isLoading = signal(false);
  userEmail = signal('');
  
  showAddForm = signal(false);
  addFormData = signal({
    url: '',
    username: '',
    password: '',
    notes: ''
  });
  addFormError = signal('');
  isSaving = signal(false);

  showImportDialog = signal(false);

  credentials = computed(() => {
    const query = this.searchQuery();
    const allCreds = this.vaultService.getCredentials()();

    if (!query.trim()) {
      return allCreds;
    }

    const lowerQuery = query.toLowerCase();
    return allCreds.filter(cred =>
      cred.server.toLowerCase().includes(lowerQuery) ||
      cred.account.toLowerCase().includes(lowerQuery) ||
      cred.data.url?.toLowerCase().includes(lowerQuery)
    );
  });

  isEmpty = computed(() => this.credentials().length === 0);
  hasSearchResults = computed(() => this.searchQuery().trim() !== '' && this.credentials().length > 0);

  constructor(
    public vaultService: VaultService,
    private authService: AuthService,
    private sessionStorage: SessionStorageService,
    private router: Router
  ) {}

  async ngOnInit() {
    const email = this.sessionStorage.getEmail();
    if (email) {
      this.userEmail.set(email);
    }
    
    this.isLoading.set(true);
    try {
      await this.vaultService.loadCredentials();
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectCredential(credential: VaultCredential): void {
    this.selectedCredential.set(credential);
    this.showPassword.set(null);
  }

  togglePasswordVisibility(uuid: string): void {
    if (this.showPassword() === uuid) {
      this.showPassword.set(null);
    } else {
      this.showPassword.set(uuid);
    }
  }

  async copyToClipboard(text: string, type: 'username' | 'password'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async deleteCredential(credential: VaultCredential): Promise<void> {
    if (!confirm(`Delete credential for ${credential.server}?`)) {
      return;
    }

    try {
      await this.vaultService.deleteCredential(credential.uuid);
      if (this.selectedCredential()?.uuid === credential.uuid) {
        this.selectedCredential.set(null);
      }
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  getInitials(server: string): string {
    return server
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('.')[0]
      .substring(0, 2)
      .toUpperCase();
  }

  getColorForServer(server: string): string {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#4facfe',
      '#43e97b', '#fa709a', '#30cfd0', '#a8edea'
    ];
    
    const hash = server.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  formatDate(timestamp?: number): string {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  async lockVault(): Promise<void> {
    await this.vaultService.lock();
    this.router.navigate(['/vault/unlock']);
  }

  async logout(): Promise<void> {
    await this.vaultService.lock();
    this.authService.logout();
    this.sessionStorage.clearSession();
    this.router.navigate(['/auth/login']);
  }

  openAddForm(): void {
    this.showAddForm.set(true);
    this.addFormData.set({
      url: '',
      username: '',
      password: '',
      notes: ''
    });
    this.addFormError.set('');
  }

  closeAddForm(): void {
    this.showAddForm.set(false);
    this.addFormError.set('');
  }

  async saveNewCredential(): Promise<void> {
    const data = this.addFormData();
    
    if (!data.url || !data.username || !data.password) {
      this.addFormError.set('URL, username, and password are required');
      return;
    }

    this.isSaving.set(true);
    this.addFormError.set('');

    try {
      await this.vaultService.addCredential(
        data.url,
        data.username,
        data.password,
        data.notes || undefined
      );
      
      this.closeAddForm();
      await this.vaultService.loadCredentials();
    } catch (error) {
      this.addFormError.set(`Failed to save credential: ${error}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  generatePassword(): void {
    const length = 20;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    
    this.addFormData.update(data => ({ ...data, password }));
  }

  updateFormUrl(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.addFormData.update(data => ({ ...data, url: value }));
  }

  updateFormUsername(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.addFormData.update(data => ({ ...data, username: value }));
  }

  updateFormPassword(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.addFormData.update(data => ({ ...data, password: value }));
  }

  updateFormNotes(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.addFormData.update(data => ({ ...data, notes: value }));
  }

  openImportDialog(): void {
    this.showImportDialog.set(true);
  }

  closeImportDialog(): void {
    this.showImportDialog.set(false);
  }

  async handleImportComplete(result: ImportResult): Promise<void> {
    console.log('Import completed:', result);

    // Reload credentials to show newly imported ones
    if (result.success && result.imported > 0) {
      await this.vaultService.loadCredentials();
    }
  }

  async deleteAllCredentials(): Promise<void> {
    const confirmed = confirm(
      'Are you sure you want to delete ALL credentials from the server?\n\n' +
      'This will mark all credentials as deleted on the server. ' +
      'This action affects all devices synced to your account.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.vaultService.deleteAllCredentials();
      alert('All credentials have been deleted successfully.');
    } catch (error) {
      console.error('Failed to delete all credentials:', error);
      alert(`Failed to delete credentials: ${error}`);
    }
  }
}
