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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

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
      const err = exception as QueryFailedError & { code?: string };
      if (err.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these details already exists';
      } else if (err.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Referenced record does not exist';
      }
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
