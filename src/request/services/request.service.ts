import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG, type AuthConfig } from '../../auth/auth.config';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  constructor(
    @Inject(REQUEST) private readonly injectedRequest: FastifyRequest,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  // NestJS injects the raw Fastify request for HTTP, but for GraphQL it injects the GraphQL
  // context object ({ req, reply }) — which has no `.headers`. Unwrap to the real Fastify
  // request so every accessor below works across both transports.
  private get request(): FastifyRequest {
    const injected = this.injectedRequest as unknown as { headers?: unknown; req?: FastifyRequest };
    if (injected && injected.headers === undefined && injected.req) {
      return injected.req;
    }
    return this.injectedRequest;
  }

  // Extracts the bearer access token from the Authorization header
  getAccessToken(): string | null {
    const authHeader = this.request.headers?.[this.config.guard.authHeaderName];
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }
    const [type, token] = authHeader.split(' ') ?? [];
    return type === this.config.guard.tokenPrefix && token ? token : null;
  }

  // Extracts the refresh token from the configured httpOnly cookie
  getRefreshToken(): string | null {
    try {
      const cookies = (this.request as unknown as { cookies?: Record<string, string> }).cookies;
      if (cookies && typeof cookies === 'object') {
        const refreshToken = cookies[this.config.cookie.refreshCookieName];
        if (refreshToken) {
          return refreshToken;
        }
      }
      return null;
    } catch (_error: unknown) {
      return null;
    }
  }

  // Returns the value of a specific request header by key
  getHeader(key: string): string | string[] | undefined {
    return this.request.headers?.[key];
  }

  // Returns the request hostname (without port)
  getHostname(): string {
    return this.request.hostname ?? '';
  }

  // Returns all request headers
  getAllHeaders(): FastifyRequest['headers'] {
    return this.request.headers || {};
  }
}
