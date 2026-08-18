import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../../types/fastify-augmentation';
import { getRequestFromContext, getResponseFromContext } from '../../context';
import { RequestService } from '../../request/services/request.service';
import { APP_SESSION_TYPE } from '../app-request';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config';
import { REQUIRE_APP_KEY } from '../decorators/require-app.decorator';
import { REQUIRE_SESSION_KEY } from '../decorators/require-session.decorator';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { TokenService } from '../services/token.service';

interface FastifyInstanceWithCsrf {
  csrfProtection?: (req: FastifyRequest, reply: FastifyReply, next: (err?: Error) => void) => void;
}

type PatchableReply = { send: (...args: unknown[]) => unknown };

@Injectable({ scope: Scope.REQUEST })
export class VrittiAuthGuard implements CanActivate {
  private readonly logger = new Logger(VrittiAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly requestService: RequestService,
    private readonly tokenService: TokenService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context);
    const reply = getResponseFromContext(context);
    const route = `${request.method} ${request.url}`;

    // Attach auth config to request so decorators can access it without injection
    request.authConfig = this.config;

    // CSRF is skipped via @SkipCsrf() or when the request transport is CSRF-exempt (e.g. 'graphql')
    const csrfExemptTransports = this.config.guard.csrfExemptTransports ?? [];
    const skipCsrf =
      this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [context.getHandler(), context.getClass()]) ||
      csrfExemptTransports.includes(context.getType<string>());

    // @RequireApp() authenticates an external app by its request signature.
    //
    // Placed before the public check on purpose: an app endpoint is not anonymous,
    // so it must never fall through to the @Public() branch. Returning from here
    // also means CSRF never runs on an app request — a signed server-to-server call
    // carries no cookie for CSRF to protect, and that holds on REST too, which a
    // transport-level exemption would not cover.
    const requiredAppTypes = this.reflector.getAllAndOverride<string[]>(REQUIRE_APP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAppTypes) {
      return this.handleAppAuth(request, requiredAppTypes, route);
    }

    // @Public() endpoints skip auth, while preserving their current CSRF behavior
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [context.getHandler(), context.getClass()]);
    if (isPublic) {
      if (!skipCsrf) {
        await this.validateCsrf(request, reply);
      }
      this.logger.debug(`${route} — public endpoint, skipping auth`);
      return true;
    }

    // @RequireSession() restricts access to specific session types
    const requiredSessionTypes = this.reflector.getAllAndOverride<string[]>(REQUIRE_SESSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // SSE endpoints authenticate via refresh token cookie (EventSource cannot send Authorization headers)
    const isSseEndpoint = this.reflector.get<boolean>(SSE_METADATA, context.getHandler());
    if (isSseEndpoint) {
      this.logger.debug(`${route} — SSE endpoint, authenticating via refresh cookie`);
      return this.handleSseAuth(request, requiredSessionTypes);
    }

    const sessionType = await this.handleHttpAuth(request, requiredSessionTypes);

    const csrfExemptSessionTypes = this.config.guard.csrfExemptSessionTypes ?? [];
    if (!skipCsrf && !csrfExemptSessionTypes.includes(sessionType)) {
      await this.validateCsrf(request, reply);
    }

    return true;
  }

  /**
   * Authenticates a signed request from an external app.
   *
   * The credential lookup and the signature check are the consuming server's job —
   * it is the only side with a database — so this delegates to
   * `guard.onAuthenticated`, the same hook the session path already uses to resolve
   * organization and workspace context. That server fills in `organizationId`,
   * `appType` and whatever else it knows.
   *
   * What stays here is the part only this side can do: reading the decorator's
   * metadata and enforcing the app-type filter against what the server resolved.
   *
   * An empty list means "any type" — the caller is still authenticated. That makes
   * `@RequireApp()` with no arguments mean what it reads like.
   */
  private async handleAppAuth(request: FastifyRequest, requiredAppTypes: string[], route: string): Promise<boolean> {
    const onAuthenticated = this.config.guard.onAuthenticated;
    if (!onAuthenticated) {
      // Fail closed. Without the hook nothing can verify the signature, and
      // treating the request as authenticated would leave the endpoint wide open.
      this.logger.error(`${route} — @RequireApp() requires guard.onAuthenticated to be configured`);
      throw new UnauthorizedException('App authentication is not configured');
    }

    // Seeded so the hook has something to populate, matching how the session path
    // hands it an object to mutate.
    const sessionInfo = { sessionType: APP_SESSION_TYPE } as NonNullable<FastifyRequest['sessionInfo']>;
    request.sessionInfo = sessionInfo;

    await onAuthenticated(this.requestService, sessionInfo);

    if (requiredAppTypes.length && !requiredAppTypes.includes(sessionInfo.appType ?? '')) {
      this.logger.warn(
        `${route} — app type ${sessionInfo.appType ?? 'unknown'} not in allowed: [${requiredAppTypes.join(', ')}]`,
      );
      // Deliberately the same error the server raises for an unknown client, a
      // revoked one or a bad signature. Distinguishing them would tell whoever is
      // probing which of the four they hit.
      throw new UnauthorizedException('This client is not recognised.');
    }

    // No organization in this message on purpose: which field holds the tenant is
    // the consuming server's augmentation, not something this side knows about.
    this.logger.debug(`${route} — authenticated app (${sessionInfo.appType})`);
    return true;
  }

  // Authenticates standard HTTP requests using the access token from Authorization header
  private async handleHttpAuth(request: FastifyRequest, requiredSessionTypes?: string[]): Promise<string> {
    const route = `${request.method} ${request.url}`;

    const accessToken = this.requestService.getAccessToken();
    if (!accessToken) {
      this.logger.warn(`${route} — no access token found`);
      throw new UnauthorizedException('Access token not found');
    }

    const decoded = this.tokenService.validateAccessToken(accessToken);

    const refreshTokenBindingExemptSessionTypes = this.config.guard.refreshTokenBindingExemptSessionTypes ?? [];

    if (!refreshTokenBindingExemptSessionTypes.includes(decoded.sessionType)) {
      const refreshToken = this.requestService.getRefreshToken();
      if (!refreshToken) {
        throw new UnauthorizedException('Session validation failed');
      }
      this.tokenService.validateTokenBinding(decoded, refreshToken);
    }

    // Validate session type access (only if @RequireSession specifies types)
    if (requiredSessionTypes?.length && !requiredSessionTypes.includes(decoded.sessionType)) {
      this.logger.warn(
        `${route} — session type ${decoded.sessionType} not in allowed: [${requiredSessionTypes.join(', ')}]`,
      );
      throw new UnauthorizedException(`${decoded.sessionType} sessions cannot access this endpoint`);
    }

    // Attach session info to request — spread full decoded token (includes metadata fields)
    const { tokenType: _tokenType, refreshTokenHash: _hash, exp: _exp, iat: _iat, ...sessionInfo } = decoded;
    request.sessionInfo = sessionInfo;

    // Call onAuthenticated callback if configured
    const onAuthenticated = this.config.guard.onAuthenticated;
    if (onAuthenticated) {
      await onAuthenticated(this.requestService, request.sessionInfo);
    }

    this.logger.debug(`${route} — authenticated user: ${decoded.userId} (${decoded.sessionType})`);
    return decoded.sessionType;
  }

  // Authenticates SSE connections using the refresh token httpOnly cookie
  private handleSseAuth(request: FastifyRequest, requiredSessionTypes?: string[]): boolean {
    const refreshToken = this.requestService.getRefreshToken();
    if (!refreshToken) {
      this.logger.warn(`SSE ${request.url} — no refresh token cookie`);
      throw new UnauthorizedException('Authentication required');
    }

    const decoded = this.tokenService.validateRefreshToken(refreshToken);

    if (requiredSessionTypes?.length && !requiredSessionTypes.includes(decoded.sessionType)) {
      this.logger.warn(`SSE ${request.url} — session type ${decoded.sessionType} not allowed`);
      throw new UnauthorizedException(`${decoded.sessionType} sessions cannot access this endpoint`);
    }

    const { tokenType: _tokenType, exp: _exp, iat: _iat, ...sessionInfo } = decoded;
    request.sessionInfo = sessionInfo;

    this.logger.debug(`SSE ${request.url} — authenticated user: ${decoded.userId} (${decoded.sessionType})`);
    return true;
  }

  // Validates CSRF token for state-changing requests
  private async validateCsrf(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) return;

    try {
      const fastifyInstance = request.server as unknown as FastifyInstanceWithCsrf;
      const csrfProtection = fastifyInstance.csrfProtection;
      if (!csrfProtection) {
        throw new ForbiddenException('CSRF protection not configured');
      }

      await new Promise<void>((resolve, reject) => {
        const originalSend = reply.send.bind(reply);
        (reply as PatchableReply).send = () => {
          (reply as PatchableReply).send = originalSend as PatchableReply['send'];
          reject(new Error('CSRF validation failed'));
          return reply;
        };

        csrfProtection(request, reply, (err?: Error) => {
          (reply as PatchableReply).send = originalSend as PatchableReply['send'];
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (_error: unknown) {
      this.logger.warn(`${request.method} ${request.url} — CSRF validation failed`);
      throw new ForbiddenException({
        errors: [{ field: 'csrf', message: 'Invalid or missing CSRF token' }],
        message: 'CSRF validation failed',
      });
    }
  }
}
