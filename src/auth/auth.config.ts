import type { FastifyRequest } from 'fastify';
import type { RequestService } from '../request/services/request.service';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export type OnAuthenticatedCallback = (
  requestService: RequestService,
  sessionInfo: NonNullable<FastifyRequest['sessionInfo']>,
) => void | Promise<void>;

export type TokenExpiryString = `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

export interface TokenExpiry {
  access: TokenExpiryString;
  refresh: TokenExpiryString;
}

export interface CookieConfig {
  refreshCookieName: string;
  refreshCookieMaxAge: number;
  refreshCookiePath: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: 'strict' | 'lax' | 'none';
  refreshCookieDomain?: string;
}

export interface GuardConfig {
  authHeaderName: string;
  tokenPrefix: string;
  csrfExemptSessionTypes?: string[];
  csrfExemptTransports?: string[];
  refreshTokenBindingExemptSessionTypes?: string[];
  onAuthenticated?: OnAuthenticatedCallback;
}

export interface AuthConfig {
  tokenExpiry: TokenExpiry;
  cookie: CookieConfig;
  guard: GuardConfig;
}

export const AUTH_CONFIG_DEFAULTS = {
  cookie: {
    refreshCookieName: 'vritti_refresh',
    refreshCookieMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    refreshCookiePath: '/',
    refreshCookieSecure: process.env.NODE_ENV === 'production',
    refreshCookieSameSite: 'strict' as const,
    refreshCookieDomain: 'localhost',
  },
  guard: {
    authHeaderName: 'authorization',
    tokenPrefix: 'Bearer',
    csrfExemptSessionTypes: [],
    csrfExemptTransports: [],
    refreshTokenBindingExemptSessionTypes: [],
  },
} satisfies Omit<AuthConfig, 'tokenExpiry'>;

export interface CookieSerializeOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
  domain: string;
}

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

interface JwtClaims {
  exp: number;
  iat: number;
}

export interface AccessTokenPayload {
  sessionType: string;
  tokenType: TokenType.ACCESS;
  userId: string;
  sessionId: string;
  refreshTokenHash: string;
}

export type DecodedAccessToken = AccessTokenPayload & JwtClaims;

export interface RefreshTokenPayload {
  sessionType: string;
  tokenType: TokenType.REFRESH;
  userId: string;
  sessionId: string;
}

export type DecodedRefreshToken = RefreshTokenPayload & JwtClaims;
