/**
 * Production Environment Configuration
 */

export const environment = {
  production: true,

  // API Configuration - Update for production deployment
  API_BASE_URL: 'http://5.161.200.4:8081',
  WS_BASE_URL: 'ws://5.161.200.4:8081',

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
