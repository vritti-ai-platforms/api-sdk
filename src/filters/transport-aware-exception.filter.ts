import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

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
