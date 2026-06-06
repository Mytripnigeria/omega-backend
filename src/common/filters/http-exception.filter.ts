import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { getRequestId } from '../middleware/request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    // Full reason for the server log only — never leaked to clients on 5xx.
    let logDetail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        // ValidationPipe returns `message: string | string[]` — join arrays so
        // the client sees the actual reason instead of "[object Object]".
        const raw = (res as Record<string, unknown>).message;
        if (Array.isArray(raw)) {
          message = raw.join('; ');
        } else if (typeof raw === 'string') {
          message = raw;
        }
      }
    } else if (exception instanceof QueryFailedError) {
      const err = exception as QueryFailedError & {
        code?: string;
        detail?: string;
      };
      logDetail = `QueryFailedError ${err.code ?? '?'}: ${err.message}${
        err.detail ? ` | ${err.detail}` : ''
      }`;
      if (err.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these details already exists';
      } else if (err.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Referenced record does not exist';
      }
      // Any other DB error stays a 500 and is logged in full below.
    } else if (exception instanceof Error) {
      logDetail = exception.message;
    }

    const where = `${request.method} ${request.originalUrl}`;
    const stack = exception instanceof Error ? exception.stack : undefined;

    // 5xx are real faults — log with the underlying reason + stack so they're
    // traceable. 4xx are client errors — a concise warn is enough.
    if (status >= 500) {
      this.logger.error(
        `${where} ${status} [${requestId}] ${logDetail ?? message}`,
        stack,
      );
    } else if (status >= 400) {
      this.logger.warn(`${where} ${status} [${requestId}] ${message}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
