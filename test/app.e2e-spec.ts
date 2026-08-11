/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import {
  TRUEMONEY_CLIENT,
  TruemoneyClient,
  TruemoneyRequestOptions,
} from './../src/truemoney/truemoney-client';

class FakeTruemoneyClient implements TruemoneyClient {
  mode:
    | { kind: 'echo' }
    | { kind: 'throw'; error: Error }
    | { kind: 'envelope'; status: number; body: string } = { kind: 'echo' };

  private body = '';

  post(_url: string, options: TruemoneyRequestOptions) {
    this.body = options.body;
    if (this.mode.kind === 'throw') {
      return Promise.reject(this.mode.error);
    }
    if (this.mode.kind === 'envelope') {
      return Promise.resolve({
        status: this.mode.status,
        body: this.mode.body,
        headers: {},
      });
    }
    return Promise.resolve({
      status: 200,
      body: `{"status":{"code":"SUCCESS","message":"","data":${this.body}}}`,
      headers: {},
    });
  }

  async shutdown(): Promise<void> {}
}

describe('Truemoney-Voucher (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let client: FakeTruemoneyClient;

  beforeEach(async () => {
    client = new FakeTruemoneyClient();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TRUEMONEY_CLIENT)
      .useValue(client)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    httpServer = app.getHttpServer();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /status is a 200 liveness probe', async () => {
    const res = await request(httpServer).get('/status');
    expect(res.status).toBe(200);
    expect(res.text).toBe('');
  });

  it('POST /status works too', async () => {
    const res = await request(httpServer).post('/status');
    expect(res.status).toBe(200);
  });

  it('GET / returns service info', async () => {
    const res = await request(httpServer).get('/');
    expect(res.status).toBe(200);

    const body = res.body as { service: string; routes: string[] };
    expect(body.service).toBe('truemoney-voucher');
    expect(Array.isArray(body.routes)).toBe(true);
  });

  it('redeems via GET and passes the raw body through', async () => {
    const res = await request(httpServer).get(
      '/truemoney/ABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.text).toBe(
      '{"status":{"code":"SUCCESS","message":"","data":{"mobile":"0812345678"}}}',
    );
  });

  it('redeems via POST equivalently', async () => {
    const res = await request(httpServer).post(
      '/truemoney/ABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(200);
    expect(res.text).toContain('"code":"SUCCESS"');
  });

  it('accepts a URL-encoded full campaign link as the code', async () => {
    const res = await request(httpServer).get(
      '/truemoney/https%3A%2F%2Fgift.truemoney.com%2Fcampaign%2F%3Fv%3DABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(200);
    expect(res.text).toContain('"code":"SUCCESS"');
  });

  it('answers invalid input with 200 {code:400}', async () => {
    const res = await request(httpServer).get('/truemoney/ABCD1234EFGH/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 400, message: 'Bad Request' });
  });

  it('passes the upstream TrueMoney error envelope through', async () => {
    client.mode = {
      kind: 'envelope',
      status: 400,
      body: '{"status":{"code":"VOUCHER_OUT_OF_STOCK","message":"","data":null}}',
    };
    const res = await request(httpServer).post(
      '/truemoney/ABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(200);
    expect(res.text).toBe(
      '{"status":{"code":"VOUCHER_OUT_OF_STOCK","message":"","data":null}}',
    );
  });

  it('answers client failures with 200 {code:500}', async () => {
    client.mode = { kind: 'throw', error: new Error('boom') };
    const res = await request(httpServer).get(
      '/truemoney/ABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 500, message: 'Internal Server Error' });
  });

  it('unknown paths are JSON 404', async () => {
    const res = await request(httpServer).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 404, message: 'Not Found' });
  });

  it('OPTIONS preflight is answered with 204 + CORS headers', async () => {
    const res = await request(httpServer).options(
      '/truemoney/ABCD1234EFGH/0812345678',
    );
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toBe(
      'GET,POST,OPTIONS',
    );
  });
});
