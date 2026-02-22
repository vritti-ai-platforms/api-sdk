import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../config';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  constructor(@Inject(REQUEST) private readonly request: FastifyRequest) {}

  // Extracts tenant identifier from x-tenant-id or x-subdomain request header
  getTenantIdentifier(): string | null {
    const getHeader = (key: string) => {
      const value = this.request.headers?.[key];
      return Array.isArray(value) ? value[0] : value;
    };

    return getHeader('x-tenant-id') || getHeader('x-subdomain') || null;
  }

  // Extracts the bearer access token from the Authorization header
  getAccessToken(): string | null {
    const authHeader = this.request.headers?.authorization;
    if (!authHeader) {
      return null;
    }
    const [type, token] = authHeader.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }

  // Extracts the refresh token from the configured httpOnly cookie
  getRefreshToken(): string | null {
    try {
      const cookies = (this.request as unknown as { cookies?: Record<string, string> }).cookies;
      if (cookies && typeof cookies === 'object') {
        const config = getConfig();
        const refreshToken = cookies[config.cookie.refreshCookieName];
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

  // Returns all request headers
  getAllHeaders(): FastifyRequest['headers'] {
    return this.request.headers || {};
  }
}
