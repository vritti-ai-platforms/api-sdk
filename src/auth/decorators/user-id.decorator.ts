import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/**
 * Parameter decorator to extract user ID from authenticated request
 *
 * This decorator retrieves the user ID from the request object,
 * which is set by authentication guards (JwtAuthGuard, VrittiAuthGuard).
 *
 * @returns The user's ID as a string (UUID)
 *
 * @example
 * @Post('verify-email')
 * @Onboarding()
 * async verifyEmail(@UserId() userId: string) {
 *   await this.service.verify(userId);
 * }
 *
 * @example
 * @Post('logout-all')
 * @UseGuards(JwtAuthGuard)
 * async logoutAll(@UserId() userId: string) {
 *   await this.authService.logoutAll(userId);
 * }
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user?.id) {
      throw new Error('User ID not found on request. Ensure route is protected by auth guard.');
    }

    return user.id;
  },
);
