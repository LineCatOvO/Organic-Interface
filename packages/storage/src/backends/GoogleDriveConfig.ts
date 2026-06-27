/**
 * Google Drive Storage Configuration for Organic Interface Storage
 * Defines configuration and authentication parameters for Google Drive API integration
 */

/**
 * Google Drive API client configuration
 */
export interface GoogleDriveConfig {
  /** Google OAuth2 Client ID */
  clientId: string;
  /** Google OAuth2 Client Secret */
  clientSecret: string;
  /** OAuth2 redirect URI */
  redirectUri: string;
  /** Root folder name for application storage */
  rootFolderName?: string;
  /** Enable automatic sync */
  autoSync?: boolean;
  /** Sync interval in milliseconds */
  syncInterval?: number;
  /** API endpoint (for testing/mocking) */
  apiEndpoint?: string;
}

/**
 * User credentials for Google Drive authentication
 */
export interface UserCredentials {
  /** User unique identifier */
  userId: string;
  /** OAuth2 access token */
  accessToken: string;
  /** OAuth2 refresh token */
  refreshToken?: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** User's storage space folder ID */
  folderId?: string;
}