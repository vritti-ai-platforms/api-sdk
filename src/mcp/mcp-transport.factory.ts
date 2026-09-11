import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable } from '@nestjs/common';

// One transport per request. Stateless: no session id is issued, so any node can serve any call and nothing is kept
// between calls. JSON responses rather than an SSE stream, since a tools-only server never pushes notifications.
@Injectable()
export class McpTransportFactory {
  create(): StreamableHTTPServerTransport {
    return new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  }
}
