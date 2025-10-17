import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStorageService } from '../storage/session-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionStorage = inject(SessionStorageService);
  const token = sessionStorage.getAccessToken();

  // Only add token to API requests (not external URLs)
  if (token && req.url.includes('/api/')) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};
