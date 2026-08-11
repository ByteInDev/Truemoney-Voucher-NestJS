import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TruemoneyModule } from './truemoney/truemoney.module';

@Module({
  imports: [TruemoneyModule],
  controllers: [AppController],
})
export class AppModule {}
