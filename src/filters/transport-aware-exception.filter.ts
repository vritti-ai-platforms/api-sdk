import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

// Transport-aware global exception filter. HTTP errors get the SDK's RFC 9457 formatting;
// non-HTTP transports (GraphQL today, others later) re-throw so their own driver formats the
// error — the HTTP filter writes to a Fastify reply that those transports lack. Shared so any
// app adding GraphQL (or another transport) reuses it instead of re-deriving the routing.
@Catch()
export class TransportAwareExceptionFilter implements ExceptionFilter {
  private readonly httpFilter = new HttpExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }
    this.httpFilter.catch(exception, host);
  }
}
