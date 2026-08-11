import { Test } from '@nestjs/testing';
import {
  TRUEMONEY_CLIENT,
  TruemoneyClient,
  TruemoneyRequestOptions,
} from './truemoney-client';
import { TruemoneyService } from './truemoney.service';

class MockClient implements TruemoneyClient {
  calls: { url: string; options: TruemoneyRequestOptions }[] = [];
  respond?: { status: number; body: string };
  throwError?: Error;

  post(url: string, options: TruemoneyRequestOptions) {
    this.calls.push({ url, options });
    if (this.throwError) {
      return Promise.reject(this.throwError);
    }
    return Promise.resolve({
      status: this.respond?.status ?? 200,
      body: this.respond?.body ?? '{}',
      headers: {},
    });
  }

  async shutdown(): Promise<void> {}
}

describe('TruemoneyService', () => {
  let service: TruemoneyService;
  let client: MockClient;

  beforeEach(async () => {
    client = new MockClient();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TruemoneyService,
        { provide: TRUEMONEY_CLIENT, useValue: client },
      ],
    }).compile();
    service = moduleRef.get(TruemoneyService);
  });

  it('redeems a raw code with a normalized mobile', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{"mobile":"0812345678"}}}',
    };
    const body = await service.redeem('ABCD1234EFGH', '081-234-5678');
    expect(body).toBe(client.respond.body);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].url).toBe(
      'https://gift.truemoney.com/campaign/vouchers/ABCD1234EFGH/redeem',
    );
    expect(client.calls[0].options.body).toBe('{"mobile":"0812345678"}');
  });

  it('accepts a full campaign URL as the code', async () => {
    client.respond = { status: 200, body: '{}' };
    await service.redeem(
      'https://gift.truemoney.com/campaign/?v=ABCD1234EFGH',
      '0812345678',
    );
    expect(client.calls[0].url).toContain('/vouchers/ABCD1234EFGH/redeem');
  });

  it('passes the TrueMoney envelope through on HTTP 400', async () => {
    const envelope =
      '{"status":{"code":"TARGET_USER_NOT_FOUND","message":"","data":null}}';
    client.respond = { status: 400, body: envelope };
    await expect(service.redeem('ABCD1234EFGH', '0812345678')).resolves.toBe(
      envelope,
    );
  });

  it('maps invalid input to Bad Request', async () => {
    await expect(service.redeem('ab cd', '0812345678')).rejects.toMatchObject({
      code: 400,
      status: 200,
      message: 'Bad Request',
    });
    await expect(service.redeem('ABCD1234EFGH', '123')).rejects.toMatchObject({
      code: 400,
    });
    expect(client.calls).toHaveLength(0);
  });

  it('maps an empty 2xx body to {}', async () => {
    client.respond = { status: 200, body: '' };
    await expect(service.redeem('ABCD1234EFGH', '0812345678')).resolves.toBe(
      '{}',
    );
  });

  it('maps non-envelope upstream failures to Internal Error', async () => {
    client.respond = {
      status: 503,
      body: '<html>cloudflare challenge</html>',
    };
    await expect(
      service.redeem('ABCD1234EFGH', '0812345678'),
    ).rejects.toMatchObject({
      code: 500,
      status: 200,
      message: 'Internal Server Error',
    });
  });

  it('maps client errors to Internal Error', async () => {
    client.throwError = new Error('tcp dial: connection refused');
    await expect(
      service.redeem('ABCD1234EFGH', '0812345678'),
    ).rejects.toMatchObject({
      code: 500,
    });
  });

  it('replays a cached SUCCESS answer without a second upstream call', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    await service.redeem('ABCD1234EFGH', '0812345678');
    await service.redeem('ABCD1234EFGH', '0812345678');
    expect(client.calls).toHaveLength(1);
  });

  it('caches per (code, mobile) pair', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    await service.redeem('ABCD1234EFGH', '0812345678');
    await service.redeem('ABCD1234EFGH', '0899999999');
    expect(client.calls).toHaveLength(2);
  });

  it('does not cache error envelopes', async () => {
    client.respond = {
      status: 400,
      body: '{"status":{"code":"TARGET_USER_NOT_FOUND","message":"","data":null}}',
    };
    await service.redeem('ABCD1234EFGH', '0812345678');
    await service.redeem('ABCD1234EFGH', '0812345678');
    expect(client.calls).toHaveLength(2);
  });

  it('does not cache non-envelope bodies or transport failures', async () => {
    client.respond = { status: 200, body: '<html>challenge</html>' };
    await expect(
      service.redeem('ABCD1234EFGH', '0812345678'),
    ).rejects.toBeDefined();

    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    await service.redeem('ABCD1234EFGH', '0812345678');
    await service.redeem('ABCD1234EFGH', '0812345678');
    // 1 challenge call + 1 SUCCESS call; the second SUCCESS redeem is a
    // cache hit, so the challenge was never cached.
    expect(client.calls).toHaveLength(2);
  });

  it('single-flights concurrent redeems of the same key', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    const [a, b] = await Promise.all([
      service.redeem('ABCD1234EFGH', '0812345678'),
      service.redeem('ABCD1234EFGH', '0812345678'),
    ]);
    expect(a).toBe(b);
    expect(client.calls).toHaveLength(1);
  });

  it('re-probes upstream after the cache TTL expires', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    const shortTtl = new TruemoneyService(client);
    shortTtl.cacheTtlMs = 30;
    shortTtl.cacheMax = 1024;
    await shortTtl.redeem('ABCD1234EFGH', '0812345678');

    await new Promise((resolve) => setTimeout(resolve, 40));
    await shortTtl.redeem('ABCD1234EFGH', '0812345678');
    expect(client.calls).toHaveLength(2);
  });

  it('evicts the oldest entry at capacity', async () => {
    client.respond = {
      status: 200,
      body: '{"status":{"code":"SUCCESS","message":"","data":{}}}',
    };
    const tiny = new TruemoneyService(client);
    tiny.cacheMax = 2;
    await tiny.redeem('AAAA1111AAAA', '0812345678');
    await tiny.redeem('BBBB2222BBBB', '0812345678');
    await tiny.redeem('CCCC3333CCCC', '0812345678'); // evicts AAAA
    await tiny.redeem('AAAA1111AAAA', '0812345678'); // must go upstream again
    expect(client.calls).toHaveLength(4);
  });
});
