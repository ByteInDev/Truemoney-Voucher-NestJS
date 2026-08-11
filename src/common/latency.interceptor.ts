import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, finalize } from 'rxjs';
import { LatencyRegistry, normalizePath } from './latency.registry';

// Records the end-to-end latency of every handled route (success and
// error alike), so the root endpoint can report ms per path.
@Injectable()
export class LatencyInterceptor implements NestInterceptor {
  constructor(private readonly registry: LatencyRegistry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = normalizePath(req.route?.path);
    const started = Date.now();
    return next.handle().pipe(
      finalize(() => this.registry.record(key, Date.now() - started)),
    );
  }
}