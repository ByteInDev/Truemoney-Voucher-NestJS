import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from './app-error';
import { requestTimes } from './logging.interceptor';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message } = this.resolve(exception);

    res.status(status).json({ code, message });

    const started = requestTimes.get(req) ?? Date.now();
    this.logger.log(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        status,
        duration_ms: Date.now() - (started ?? Date.now()),
      }),
    );
  }

  private resolve(exception: unknown): {
    status: number;
    code: number;
    message: string;
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
      };
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (status === HttpStatus.NOT_FOUND) {
        message = 'Not Found';
      } else {
        const body = exception.getResponse();
        if (typeof body === 'string') {
          message = body;
        } else if (
          typeof body === 'object' &&
          body !== null &&
          'message' in body
        ) {
          const m = body.message;
          message = Array.isArray(m) ? m.join(', ') : String(m);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`unhandled exception: ${String(exception)}`);
    }

    return { status, code: status, message };
  }
}
