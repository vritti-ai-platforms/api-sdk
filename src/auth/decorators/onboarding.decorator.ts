import { SetMetadata } from '@nestjs/common';

/**
 * Onboarding Decorator - Marks endpoints that require onboarding token
 *
 * Use this decorator on controllers or route handlers that should only be
 * accessible during the onboarding flow with JWT tokens containing type='onboarding'.
 *
 * These endpoints:
 * - Accept ONLY tokens with type='onboarding'
 * - Reject regular access tokens (type='access')
 * - Skip tenant validation and refresh token checks
 * - Only validate JWT signature and expiry
 *
 * Useful for:
 * - Email/phone verification during onboarding
 * - Onboarding status checks
 * - Resending OTPs during registration
 *
 * @example
 * // On a controller method
 * @Post('verify-email')
 * @Onboarding()
 * async verifyEmail(@Request() req, @Body() dto: VerifyEmailDto) {
 *   const userId = req.sessionInfo.userId; // Available from VrittiAuthGuard
 *   return this.service.verifyEmail(userId, dto.otp);
 * }
 *
 * @example
 * // Multiple onboarding endpoints
 * @Controller('onboarding')
 * export class OnboardingController {
 *   @Post('verify-email')
 *   @Onboarding()
 *   async verifyEmail() { ... }
 *
 *   @Post('resend-otp')
 *   @Onboarding()
 *   async resendOtp() { ... }
 * }
 */
export const Onboarding = () => SetMetadata('isOnboarding', true);
