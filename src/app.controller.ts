import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { LatencyRegistry } from './common/latency.registry';

@Controller()
export class AppController {
  constructor(private readonly latency: LatencyRegistry) {}

  // Liveness probe for load balancers / uptime monitors.
  @Get('status')
  @HttpCode(200)
  statusGet(): void {}

  @Post('status')
  @HttpCode(200)
  statusPost(): void {}

  // Root endpoint: minimal service info + the last observed latency (ms)
  // of every registered route, e.g.
  // { "ms": { "/": 1, "/status": 0, "/truemoney": 342 },
  //   "message": "ByteInDev Service" }
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
      ms: this.latency.snapshot(),
      message: 'ByteInDev Service',
    };
  }
}
