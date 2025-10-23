/**
 * Environment Configuration
 *
 * This file contains environment-specific settings.
 * You can override the API_BASE_URL by:
 * 1. Setting localStorage key 'serverUrl' in the app
 * 2. Changing the default value below
 *
 * For local development: Use 'localhost'
 * For testing on mobile devices: Use your computer's IP (e.g., '192.168.86.22')
 */

export const environment = {
  production: false,

  // API Configuration
  // Change this to your computer's IP address when testing with mobile devices
  // e.g., 'http://192.168.86.22:8080' or keep as 'http://localhost:8080'
  // Production server: 'http://5.161.200.4:8081'
  API_BASE_URL: 'http://5.161.200.4:8081',

  // WebSocket Configuration
  // Change this to your computer's IP address when testing with mobile devices
  // e.g., 'ws://192.168.86.22:8080' or keep as 'ws://localhost:8080'
  // Production server: 'ws://5.161.200.4:8081'
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
