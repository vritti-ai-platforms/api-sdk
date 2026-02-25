import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../../auth/decorators/public.decorator';
import { ApiGetCsrfToken } from '../docs/csrf.docs';

// Type augmentation for @fastify/csrf-protection — added by the consuming server at runtime
type FastifyReplyWithCsrf = FastifyReply & { generateCsrf(): string };

@ApiTags('CSRF')
@Controller('csrf')
export class CsrfController {
  // Generates a CSRF token via Fastify's csrf-protection plugin
  @Get('token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiGetCsrfToken()
  getToken(@Res({ passthrough: true }) reply: FastifyReply): { csrfToken: string } {
    const csrfToken = (reply as FastifyReplyWithCsrf).generateCsrf();
    return { csrfToken };
  }
}
