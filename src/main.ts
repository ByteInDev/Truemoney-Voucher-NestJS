import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { loadPort } from './config/app.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  let port: number;
  try {
    port = loadPort();
  } catch (err) {
    logger.error(`load config failed: ${(err as Error).message}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`server listening on :${port}`);
}

void bootstrap();
