import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfigFactory = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.getOrThrow<string>('JWT_SECRET'),
  signOptions: {
    issuer: 'vritti-api',
  },
});

type TokenExpiryString = `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

export interface TokenExpiry {
  access: TokenExpiryString;
  refresh: TokenExpiryString;
}

export const getTokenExpiry = (configService: ConfigService): TokenExpiry => ({
  access: configService.getOrThrow<string>('ACCESS_TOKEN_EXPIRY') as TokenExpiryString,
  refresh: configService.getOrThrow<string>('REFRESH_TOKEN_EXPIRY') as TokenExpiryString,
});

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

// sessionType typed as string — each server's enum is a valid subtype
export interface AccessTokenPayload {
  sessionType: string;
  tokenType: TokenType.ACCESS;
  userId: string;
  sessionId: string;
  refreshTokenHash: string;
}

export interface RefreshTokenPayload {
  sessionType: string;
  tokenType: TokenType.REFRESH;
  userId: string;
  sessionId: string;
}
