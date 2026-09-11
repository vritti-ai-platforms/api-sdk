import type { FastifyRequest } from 'fastify';
import { UnauthorizedException } from '../exceptions';
import '../types/fastify-augmentation';

// Who a tool call acts as, whatever authenticated the request. Scopes are the server's own vocabulary; the registry
// only compares them with each tool's requiredScope.
export class McpPrincipal {
  constructor(
    readonly userId: string,
    readonly scopes: readonly string[],
    readonly clientId?: string,
    readonly grantId?: string,
    readonly organizationId?: string,
  ) {}

  hasScope(scope: string): boolean {
    return this.scopes.includes(scope);
  }
}

export type McpPrincipalFactory = (request: FastifyRequest) => McpPrincipal;

export const MCP_PRINCIPAL_FACTORY = Symbol('MCP_PRINCIPAL_FACTORY');

// The default: an OAuth bearer the auth guard resolved. Fails loudly when the guard did not run — a missing principal
// must never mean "no restrictions". Servers that authenticate MCP calls another way supply their own factory.
export function principalFromOAuth(request: FastifyRequest): McpPrincipal {
  const auth = request.auth;
  if (!auth || auth.kind !== 'oauth' || !auth.userId || !auth.grantId) {
    throw new UnauthorizedException('MCP request is not authenticated.');
  }
  return new McpPrincipal(auth.userId, auth.scopes ?? [], auth.clientId, auth.grantId, auth.organizationId);
}
