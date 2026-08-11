import { Controller, Get, HttpCode, Post } from '@nestjs/common';

@Controller()
export class AppController {
  // Liveness probe for load balancers / uptime monitors.
  @Get('status')
  @HttpCode(200)
  statusGet(): void {}

  @Post('status')
  @HttpCode(200)
  statusPost(): void {}

  // Root endpoint: basic service information.
  @Get()
  rootGet(): Record<string, unknown> {
    return this.rootInfo();
  }

  @Post()
  rootPost(): Record<string, unknown> {
    return this.rootInfo();
  }

  private rootInfo(): Record<string, unknown> {
    return {
      service: 'truemoney-voucher',
      routes: [
        'GET|POST /truemoney/{code}/{mobile}  redeem voucher',
        'GET|POST /status                     liveness probe',
      ],
    };
  }
}
