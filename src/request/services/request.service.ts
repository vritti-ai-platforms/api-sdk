import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../config';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  constructor(@Inject(REQUEST) private readonly request: FastifyRequest) {}

  /**
   * Extract tenant identifier from request headers
   * Priority: x-tenant-id > x-subdomain
   * @returns Tenant identifier or null if not found
   */
  getTenantIdentifier(): string | null {
    const getHeader = (key: string) => {
      const value = this.request.headers?.[key];
      return Array.isArray(value) ? value[0] : value;
    };

    return getHeader('x-tenant-id') || getHeader('x-subdomain') || null;
  }

  /**
   * Extract access token from Authorization header
   * Format: "Bearer <token>"
   * @returns Access token or null if not found
   */
  getAccessToken(): string | null {
    const authHeader = this.request.headers?.authorization;
    if (!authHeader) {
      return null;
    }
    const [type, token] = authHeader.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }

  /**
   * Extract refresh token from httpOnly cookie
   * Cookie name is configurable via api-sdk config
   * @returns Refresh token or null if not found
   */
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

  /**
   * Get a specific header value
   * @param key Header key
   * @returns Header value (string, array, or undefined)
   */
  getHeader(key: string): string | string[] | undefined {
    return this.request.headers?.[key];
  }

  /**
   * Get all headers
   * @returns Record of all headers
   */
  getAllHeaders(): FastifyRequest['headers'] {
    return this.request.headers || {};
  }
}
