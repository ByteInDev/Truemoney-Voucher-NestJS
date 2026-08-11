import { Module } from '@nestjs/common';
import { TRUEMONEY_CLIENT } from './truemoney-client';
import { CycletlsTruemoneyClient } from './truemoney-client.cycletls';
import { TruemoneyController } from './truemoney.controller';
import { TruemoneyService } from './truemoney.service';

@Module({
  controllers: [TruemoneyController],
  providers: [
    TruemoneyService,
    {
      provide: TRUEMONEY_CLIENT,
      useClass: CycletlsTruemoneyClient,
    },
  ],
})
export class TruemoneyModule {}
