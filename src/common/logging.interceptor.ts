import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

export const requestTimes = new WeakMap<Request, number>();

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    requestTimes.set(req, Date.now());

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res),
        error: () => {
          // Errors are logged exactly once by the exception filter, which
          // decides the final status code after this pipe runs.
        },
      }),
    );
  }

  private log(req: Request, res: Response): void {
    const started = requestTimes.get(req) ?? Date.now();
    this.logger.log(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - started,
      }),
    );
  }
}
