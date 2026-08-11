import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    controller = moduleRef.get(AppController);
  });

  it('status returns nothing', () => {
    expect(controller.statusGet()).toBeUndefined();
    expect(controller.statusPost()).toBeUndefined();
  });

  it('root returns service info', () => {
    const info = controller.rootGet();
    expect(info.service).toBe('truemoney-voucher');
    expect(info.routes).toHaveLength(2);
    expect(controller.rootPost()).toEqual(info);
  });
});
