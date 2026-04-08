import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import '../../types/fastify-augmentation';
import { parseExpiryToMs } from '../../utils/time.utils';
import {
  AUTH_CONFIG,
  type AuthConfig,
  type DecodedAccessToken,
  type DecodedRefreshToken,
  TokenType,
} from '../auth.config';
import { hashToken, verifyTokenHash } from '../utils/token-hash.util';

export type { DecodedAccessToken, DecodedRefreshToken };

// Session info type from Fastify augmentation
type SessionInfo = NonNullable<FastifyRequest['sessionInfo']>;

interface TokenError extends Error {
  name: 'TokenExpiredError' | 'JsonWebTokenError' | 'NotBeforeError';
}

// Handles all token operations — generation, validation, and binding verification
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  // ---- Generation ----

  // Generates an access token bound to the given refresh token
  generateAccessToken(sessionInfo: SessionInfo, refreshToken: string): string {
    const { userId, sessionId, sessionType, ...metadata } = sessionInfo;
    return this.jwtService.sign(
      { sessionType, tokenType: TokenType.ACCESS, userId, sessionId, refreshTokenHash: hashToken(refreshToken), ...metadata },
      { expiresIn: this.config.tokenExpiry.access },
    );
  }

  // Generates a refresh token for session persistence
  generateRefreshToken(sessionInfo: SessionInfo): string {
    const { userId, sessionId, sessionType, ...metadata } = sessionInfo;
    return this.jwtService.sign(
      { sessionType, tokenType: TokenType.REFRESH, userId, sessionId, ...metadata },
      { expiresIn: this.config.tokenExpiry.refresh },
    );
  }

  // Signs an arbitrary payload with optional JWT options
  sign(payload: object, options?: JwtSignOptions): string {
    return this.jwtService.sign(payload, options);
  }

  // Verifies a token and ensures it matches the expected token type
  verify(
    token: string,
    expectedType: TokenType,
  ): { userId: string; sessionId: string; sessionType: string; tokenType: TokenType } {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.tokenType !== expectedType) {
        throw new Error(`Expected ${expectedType} token, got ${payload.tokenType}`);
      }

      return payload;
    } catch (error) {
      this.logger.error(`Failed to verify ${expectedType} token`, error);
      throw error;
    }
  }

  // Returns the expiry as a Date for the given token type
  getExpiryTime(type: TokenType): Date {
    return new Date(Date.now() + parseExpiryToMs(this.config.tokenExpiry[type]));
  }

  // Returns the token lifetime in seconds for the given type
  getExpiryInSeconds(type: TokenType): number {
    return Math.floor(parseExpiryToMs(this.config.tokenExpiry[type]) / 1000);
  }

  // ---- Validation ----

  // Decodes and validates an access token JWT
  validateAccessToken(token: string): DecodedAccessToken {
    try {
      const decoded = this.jwtService.verify<DecodedAccessToken>(token);

      if (decoded.tokenType !== TokenType.ACCESS) {
        throw new UnauthorizedException('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      const jwtError = error as TokenError;
      switch (jwtError.name) {
        case 'TokenExpiredError':
          throw new UnauthorizedException('Access token has expired');
        case 'JsonWebTokenError':
          throw new UnauthorizedException('Invalid access token');
        case 'NotBeforeError':
          throw new UnauthorizedException('Access token not yet valid');
        default:
          throw new UnauthorizedException('Access token validation failed');
      }
    }
  }

  // Decodes and validates a refresh token JWT
  validateRefreshToken(token: string): DecodedRefreshToken {
    try {
      const decoded = this.jwtService.verify<DecodedRefreshToken>(token);

      if (decoded.tokenType !== TokenType.REFRESH) {
        throw new UnauthorizedException('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  // Validates that the access token is bound to the refresh token
  validateTokenBinding(accessToken: DecodedAccessToken, refreshToken: string): void {
    if (!verifyTokenHash(refreshToken, accessToken.refreshTokenHash)) {
      throw new UnauthorizedException('Session validation failed');
    }
  }
}
