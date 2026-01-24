import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Decorator to skip CSRF validation for specific routes or controllers.
 * Use this for webhook endpoints that receive requests from external services
 * (e.g., WhatsApp, Twilio) which cannot include CSRF tokens.
 *
 * @example
 * // Skip CSRF for entire controller
 * @Controller('webhooks')
 * @SkipCsrf()
 * export class WebhookController { ... }
 *
 * @example
 * // Skip CSRF for specific route
 * @Post()
 * @SkipCsrf()
 * async handleWebhook() { ... }
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
