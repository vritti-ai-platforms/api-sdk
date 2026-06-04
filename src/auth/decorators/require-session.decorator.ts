import { SetMetadata } from '@nestjs/common';

// Restricts endpoint access to specific session types
export const REQUIRE_SESSION_KEY = 'requiredSessionTypes';
export const RequireSession = (...types: string[]) => SetMetadata(REQUIRE_SESSION_KEY, types);
