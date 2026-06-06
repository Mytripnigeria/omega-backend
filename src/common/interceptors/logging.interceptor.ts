import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { getRequestId } from '../middleware/request-context';

/**
 * Access log for every HTTP request: method, path, status, duration and the
 * request's correlation id. Errors are logged in detail by HttpExceptionFilter,
 * so this only logs the successful path to avoid duplicate noise.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl;
    const reqId = getRequestId(req);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`${method} ${url} ${res.statusCode} +${ms}ms [${reqId}]`);
      }),
    );
  }
}
