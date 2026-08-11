import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { LatencyRegistry } from './common/latency.registry';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: LatencyRegistry,
          useValue: {
            snapshot: () => ({ '/': 0, '/status': 0, '/truemoney': 42 }),
          },
        },
      ],
    }).compile();
    controller = moduleRef.get(AppController);
  });

  it('status returns nothing', () => {
    expect(controller.statusGet()).toBeUndefined();
    expect(controller.statusPost()).toBeUndefined();
  });

  it('root returns per-path ms + message only', () => {
    const info = controller.rootGet();
    expect(info).toEqual({
      ms: { '/': 0, '/status': 0, '/truemoney': 42 },
      message: 'ByteInDev Service',
    });
  });
});
