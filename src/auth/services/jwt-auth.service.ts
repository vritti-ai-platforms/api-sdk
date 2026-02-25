import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JwtSignOptions, JwtService as NestJwtService } from '@nestjs/jwt';
import { parseExpiryToMs } from '../../utils/time.utils';
import { getTokenExpiry, type TokenExpiry, TokenType } from '../jwt.config';
import { hashToken } from '../utils/token-hash.util';

@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);
  private readonly tokenExpiry: TokenExpiry;

  constructor(
    private readonly jwtService: NestJwtService,
    readonly configService: ConfigService,
  ) {
    this.tokenExpiry = getTokenExpiry(configService);
  }

  // Generates an access token bound to the given refresh token
  generateAccessToken(userId: string, sessionId: string, sessionType: string, refreshToken: string): string {
    return this.jwtService.sign(
      { sessionType, tokenType: TokenType.ACCESS, userId, sessionId, refreshTokenHash: hashToken(refreshToken) },
      { expiresIn: this.tokenExpiry.access },
    );
  }

  // Generates a refresh token for session persistence
  generateRefreshToken(userId: string, sessionId: string, sessionType: string): string {
    return this.jwtService.sign(
      { sessionType, tokenType: TokenType.REFRESH, userId, sessionId },
      { expiresIn: this.tokenExpiry.refresh },
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
    return new Date(Date.now() + parseExpiryToMs(this.tokenExpiry[type]));
  }

  // Returns the token lifetime in seconds for the given type
  getExpiryInSeconds(type: TokenType): number {
    return Math.floor(parseExpiryToMs(this.tokenExpiry[type]) / 1000);
  }
}
