import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { LatencyInterceptor } from './common/latency.interceptor';
import { LatencyRegistry } from './common/latency.registry';
import { TruemoneyModule } from './truemoney/truemoney.module';

@Module({
  imports: [TruemoneyModule],
  controllers: [AppController],
  providers: [
    LatencyRegistry,
    { provide: APP_INTERCEPTOR, useClass: LatencyInterceptor },
  ],
})
export class AppModule {}
