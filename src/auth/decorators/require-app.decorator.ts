import { SetMetadata } from '@nestjs/common';

// Restricts endpoint access to signed requests from specific app types
export const REQUIRE_APP_KEY = 'requiredAppTypes';

/**
 * Authenticates an external app by its request signature, and restricts the
 * endpoint to the given app types.
 *
 * ```ts
 * @RequireApp(AppTypeValues.GRAPHQL)
 * @Mutation(() => Person, { name: 'createPerson' })
 * async createPerson(@Args('input') input: CreatePersonInput) {}
 * ```
 *
 * Metadata only, exactly like `@RequireSession` — `VrittiAuthGuard` reads it and
 * branches. Nothing else is needed at the call site:
 *
 * - no `@Public()`, because the guard's app branch runs *before* the public check
 * - no `@UseGuards()`, because the global guard owns this
 * - no `@SkipCsrf()`, because that branch returns before CSRF is ever reached —
 *   which also covers REST, where a transport-level exemption would not
 *
 * Types are compared as strings: the enum belongs to the consuming server's
 * schema, and this only ever compares. Passing none authenticates the caller
 * without restricting which kind it is.
 *
 * The consuming server resolves the credential in its `onAuthenticated` callback,
 * which is the only side with a database. See `GuardConfig.onAuthenticated`.
 */
export const RequireApp = (...types: string[]) => SetMetadata(REQUIRE_APP_KEY, types);
