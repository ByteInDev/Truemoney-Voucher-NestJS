import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { TruemoneyService } from './truemoney.service';

@Controller('truemoney')
export class TruemoneyController {
  constructor(private readonly service: TruemoneyService) {}

  // GET and POST are equivalent -- both redeem.
  // {code} accepts a raw gift code or a full campaign URL
  // (URL-encoded in the path, decoded by the router);
  // {mobile} is a Thai mobile number.
  @Get(':code/:mobile')
  @Header('Content-Type', 'application/json')
  redeemGet(
    @Param('code') code: string,
    @Param('mobile') mobile: string,
  ): Promise<string> {
    return this.service.redeem(code, mobile);
  }

  @Post(':code/:mobile')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  redeemPost(
    @Param('code') code: string,
    @Param('mobile') mobile: string,
  ): Promise<string> {
    return this.service.redeem(code, mobile);
  }
}
