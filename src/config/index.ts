export interface CookieConfig {
  refreshCookieName: string;
  refreshCookieMaxAge: number;
  refreshCookiePath: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: 'strict' | 'lax' | 'none';
  refreshCookieDomain?: string;
}

export interface JwtConfig {
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  onboardingTokenExpiry: string;

}

export interface GuardConfig {
  tenantHeaderName: string;
  authHeaderName: string;
  tokenPrefix: string;
}

export interface ApiSdkConfig {
  cookie?: Partial<CookieConfig>;
  jwt?: Partial<JwtConfig>;
  guard?: Partial<GuardConfig>;
}

export interface FullConfig {
  cookie: CookieConfig;
  jwt: JwtConfig;
  guard: GuardConfig;
}

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

let currentConfig: FullConfig = { ...defaultConfig };

// Helper to define configuration with type safety (similar to Tailwind's defineConfig)
export function defineConfig(config: ApiSdkConfig): ApiSdkConfig {
  return config;
}

// Configures api-sdk with user settings — call once in application bootstrap
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

// Returns the current active configuration
export function getConfig(): FullConfig {
  return currentConfig;
}

// Resets configuration to defaults (for testing)
export function resetConfig(): void {
  currentConfig = { ...defaultConfig };
}

// Returns refresh cookie options built from the current configuration
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

// Returns JWT expiry settings for access, refresh, and onboarding tokens
export function getJwtExpiry() {
  return {
    access: currentConfig.jwt.accessTokenExpiry,
    refresh: currentConfig.jwt.refreshTokenExpiry,
    onboarding: currentConfig.jwt.onboardingTokenExpiry,
  };
}
