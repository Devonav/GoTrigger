/**
 * Production Environment Configuration
 */

export const environment = {
  production: true,

  // API Configuration - Production deployment with HTTPS
  API_BASE_URL: 'https://gotrigger.org',
  WS_BASE_URL: 'wss://gotrigger.org',

  // API Version
  API_VERSION: 'v1',
};

/**
 * Helper to get full API URL
 */
export function getApiUrl(): string {
  return `${environment.API_BASE_URL}/api/${environment.API_VERSION}`;
}

/**
 * Helper to get full WebSocket URL
 */
export function getWsUrl(): string {
  return `${environment.WS_BASE_URL}/api/${environment.API_VERSION}/sync/live`;
}
