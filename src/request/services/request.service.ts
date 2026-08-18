import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG, type AuthConfig } from '../../auth/auth.config';
import { resolveInjectedRequest } from '../../context/resolve-request';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  constructor(
    @Inject(REQUEST) private readonly injectedRequest: FastifyRequest,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  // Unwraps the GraphQL { req, reply } context wrapper so every accessor below works across both transports
  private get request(): FastifyRequest {
    return resolveInjectedRequest(this.injectedRequest);
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

  // Returns the HTTP method
  getMethod(): string {
    return this.request.method ?? '';
  }

  /**
   * Returns the path with any query string stripped.
   *
   * Signature canonicals cover the path only, so a query string must not be part
   * of what gets signed or verified.
   */
  getPath(): string {
    const url = this.request.url ?? '';
    return url.split('?')[0] ?? url;
  }

  /**
   * Returns the raw query string, without the leading `?`.
   *
   * Companion to `getPath()`, which strips it. Signed separately so a REST request's
   * filters are covered — `getPath()` alone would sign `GET /people?search=salt` as
   * though the filter were not there.
   */
  getQuery(): string {
    const url = this.request.url ?? '';
    const index = url.indexOf('?');
    return index === -1 ? '' : url.slice(index + 1);
  }

  /**
   * Returns the raw request body, as `fastify-raw-body` leaves it.
   *
   * Read structurally rather than through a module augmentation: that plugin is the
   * consuming server's dependency, not this SDK's, and declaring `rawBody` here
   * would collide with the plugin's own declaration the moment the two drift.
   *
   * A server that has not registered it yields `undefined`, which hashes as an empty
   * body and therefore fails any signature made over real bytes — refused, never
   * waved through.
   */
  getRawBody(): string | Buffer | undefined {
    return (this.request as unknown as { rawBody?: string | Buffer }).rawBody;
  }
}
