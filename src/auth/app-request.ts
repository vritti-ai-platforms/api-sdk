/**
 * The shared contract between this guard and a server that authenticates apps.
 *
 * The guard recognises `@RequireApp()` and enforces the type filter; the server
 * resolves the credential in `guard.onAuthenticated`, because only it has a
 * database. These are the values both sides have to agree on.
 */

/** The client id an app sends alongside the standard signature headers. */
export const CLIENT_ID_HEADER = 'x-vritti-client-id';

/** The party (person) a signed request is acting for, when there is one. */
export const PARTY_ID_HEADER = 'x-party-id';

// Re-exported from the signing module, which owns it because the canonical is what
// fixes the order. Kept visible here so an auth-side consumer has one import.
export { WORKSPACE_HEADER_ORDER } from '../signing/request';

/**
 * How far a signed request's timestamp may drift before it is refused.
 *
 * Five minutes, matching the deployment-signing path. Wide enough for ordinary
 * clock drift between two servers; a captured request is replayable inside the
 * window, which is why app operations should stay idempotent.
 */
export const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * `sessionInfo.sessionType` for an app request.
 *
 * Not a value of any server's `session_type` enum — no session row exists. It is
 * here so anything reading `sessionType` can tell an app apart from a person
 * without a second field.
 */
export const APP_SESSION_TYPE = 'APP';
