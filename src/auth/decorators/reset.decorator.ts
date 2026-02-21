import { SetMetadata } from '@nestjs/common';

// Marks endpoints that require a RESET session token (password reset flow)
export const RESET_KEY = 'isReset';
export const Reset = () => SetMetadata(RESET_KEY, true);
