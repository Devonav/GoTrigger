import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/components/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/components/register/register.component').then(m => m.RegisterComponent)
      }
    ]
  },
  {
    path: 'vault',
    children: [
      {
        path: 'setup',
        loadComponent: () => import('./features/vault/components/setup-vault/setup-vault.component').then(m => m.SetupVaultComponent)
      },
      {
        path: 'unlock',
        loadComponent: () => import('./features/vault/components/unlock-vault/unlock-vault.component').then(m => m.UnlockVaultComponent)
      },
      {
        path: 'list',
        loadComponent: () => import('./features/vault/components/vault-list/vault-list.component').then(m => m.VaultListComponent)
      }
    ]
  }
];
