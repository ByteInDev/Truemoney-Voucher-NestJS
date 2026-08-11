import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppExceptionFilter } from './common/app-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'Content-Type',
  });

  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const server = app.getHttpServer() as unknown as Server;
  server.requestTimeout = 30_000; // like Go WriteTimeout
  server.headersTimeout = 10_000; // like Go ReadHeaderTimeout
  server.keepAliveTimeout = 60_000; // like Go IdleTimeout
}
