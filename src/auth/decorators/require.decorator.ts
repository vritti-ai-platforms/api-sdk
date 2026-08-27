import { SetMetadata } from '@nestjs/common';

export const REQUIRE_AUTH_KEY = 'requireAuth';

export enum AuthType {
  Session = 'session',
  App = 'app',
  Cloud = 'cloud',
  Public = 'public',
}

export interface AuthRequirement {
  type: AuthType;
  subtypes: string[];
}

// Declares how a route authenticates, and which subtypes of that caller may reach it.
//
// One decorator for every caller kind, so the branch the guard takes is stated at the call
// site rather than inferred from which of three decorators happens to be present:
//
//   @Require(AuthType.Session, SessionTypeValues.WEB)   session types WEB
//   @Require(AuthType.App, AppTypeValues.GRAPHQL)       app credentials of type GRAPHQL
//   @Require(AuthType.Cloud)                            signed control-plane calls
//   @Require(AuthType.Public)                           no authentication
//
// Subtypes are compared as strings — the enums belong to the consuming server's schema and
// this only ever compares. Passing none means "any subtype", so the caller is still
// authenticated but unrestricted.
export const Require = (type: AuthType, ...subtypes: string[]) =>
  SetMetadata<string, AuthRequirement>(REQUIRE_AUTH_KEY, { type, subtypes });
