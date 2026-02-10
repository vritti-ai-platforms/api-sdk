/**
 * api-sdk Configuration System
 *
 * Similar to quantum-ui's config pattern - provides a type-safe configuration system
 *
 * @example
 * ```typescript
 * // In vritti-api-nexus/src/main.ts
 * import { configureApiSdk } from '@vritti/api-sdk';
 *
 * configureApiSdk({
 *   cookie: {
 *     refreshCookieName: 'vritti_refresh',
 *     refreshCookieMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
 *   },
 *   jwt: {
 *     accessTokenExpiry: '15m',
 *     refreshTokenExpiry: '30d',
 *   },
 *   guard: {
 *     tenantHeaderName: 'x-tenant-id',
 *   },
 * });
 * ```
 */

/**
 * Cookie configuration options
 */
export interface CookieConfig {
  /**
   * The name of the httpOnly cookie containing the refresh token
   * @default 'vritti_refresh'
   */
  refreshCookieName: string;

  /**
   * Max age of the refresh cookie in milliseconds
   * @default 2592000000 (30 days)
   */
  refreshCookieMaxAge: number;

  /**
   * Cookie path
   * @default '/'
   */
  refreshCookiePath: string;

  /**
   * Whether the cookie is secure (HTTPS only)
   * @default true in production
   */
  refreshCookieSecure: boolean;

  /**
   * SameSite attribute for the cookie
   * @default 'strict'
   */
  refreshCookieSameSite: 'strict' | 'lax' | 'none';

  /**
   * Cookie domain (e.g., 'localhost' for dev, '.vritti.cloud' for prod)
   * Required for cross-subdomain auth (e.g., cloud.localhost accessing localhost API)
   * @default undefined (uses request domain)
   */
  refreshCookieDomain?: string;
}

/**
 * JWT token configuration options
 */
export interface JwtConfig {
  /**
   * Access token expiry time
   * @default '15m'
   */
  accessTokenExpiry: string;

  /**
   * Refresh token expiry time
   * @default '30d'
   */
  refreshTokenExpiry: string;

  /**
   * Onboarding token expiry time
   * @default '24h'
   */
  onboardingTokenExpiry: string;

}

/**
 * Auth guard configuration options
 */
export interface GuardConfig {
  /**
   * Header name for tenant ID
   * @default 'x-tenant-id'
   */
  tenantHeaderName: string;

  /**
   * Header name for authorization
   * @default 'authorization'
   */
  authHeaderName: string;

  /**
   * Token prefix (e.g., 'Bearer')
   * @default 'Bearer'
   */
  tokenPrefix: string;
}

/**
 * Complete api-sdk configuration interface
 */
export interface ApiSdkConfig {
  /**
   * Cookie configuration
   */
  cookie?: Partial<CookieConfig>;

  /**
   * JWT token configuration
   */
  jwt?: Partial<JwtConfig>;

  /**
   * Auth guard configuration
   */
  guard?: Partial<GuardConfig>;
}

/**
 * Full configuration type with all properties required
 */
export interface FullConfig {
  cookie: CookieConfig;
  jwt: JwtConfig;
  guard: GuardConfig;
}

/**
 * Default configuration values
 */
const defaultConfig: FullConfig = {
  cookie: {
    refreshCookieName: 'vritti_refresh',
    refreshCookieMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    refreshCookiePath: '/',
    refreshCookieSecure: process.env.NODE_ENV === 'production',
    refreshCookieSameSite: 'strict',
    refreshCookieDomain: 'localhost',
  },
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '30d',
    onboardingTokenExpiry: '24h',
  },
  guard: {
    tenantHeaderName: 'x-tenant-id',
    authHeaderName: 'authorization',
    tokenPrefix: 'Bearer',
  },
};

/**
 * Current active configuration
 */
let currentConfig: FullConfig = { ...defaultConfig };

/**
 * Helper function to define configuration with type safety
 * Similar to Tailwind's defineConfig()
 */
export function defineConfig(config: ApiSdkConfig): ApiSdkConfig {
  return config;
}

/**
 * Configure api-sdk with user settings
 * This should be called once in the application's bootstrap (main.ts)
 */
export function configureApiSdk(userConfig: ApiSdkConfig): void {
  currentConfig = {
    cookie: {
      ...defaultConfig.cookie,
      ...(userConfig.cookie || {}),
    },
    jwt: {
      ...defaultConfig.jwt,
      ...(userConfig.jwt || {}),
    },
    guard: {
      ...defaultConfig.guard,
      ...(userConfig.guard || {}),
    },
  };
}

/**
 * Get the current configuration
 */
export function getConfig(): FullConfig {
  return currentConfig;
}

/**
 * Reset configuration to defaults (for testing)
 */
export function resetConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Get refresh cookie options (convenience method)
 */
export function getRefreshCookieOptions() {
  const options: Record<string, unknown> = {
    httpOnly: true,
    secure: currentConfig.cookie.refreshCookieSecure,
    sameSite: currentConfig.cookie.refreshCookieSameSite,
    path: currentConfig.cookie.refreshCookiePath,
    maxAge: currentConfig.cookie.refreshCookieMaxAge,
  };

  // Only add domain if specified (needed for cross-subdomain auth like cloud.localhost)
  if (currentConfig.cookie.refreshCookieDomain) {
    options.domain = currentConfig.cookie.refreshCookieDomain;
  }

  return options;
}

/**
 * Get JWT expiry settings (convenience method)
 */
export function getJwtExpiry() {
  return {
    access: currentConfig.jwt.accessTokenExpiry,
    refresh: currentConfig.jwt.refreshTokenExpiry,
    onboarding: currentConfig.jwt.onboardingTokenExpiry,
  };
}
