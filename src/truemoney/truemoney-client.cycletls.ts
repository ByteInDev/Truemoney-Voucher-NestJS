import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import initCycleTLS, {
  type CycleTLSClient,
  type CycleTLSResponse,
} from 'cycletls';
import { CookieJar } from '../common/cookie-jar';
import {
  MAX_BODY_BYTES,
  RawResponse,
  TruemoneyClient,
  TruemoneyRequestOptions,
} from './truemoney-client';

// CycleTLS spawns its bundled Go binary with `shell: true` and requires
// the exec bit. Serverless (Vercel Lambda) bundles are read-only and may
// strip exec permissions, which makes the spawn hang silently. We copy
// the binary to a writable temp dir (once per instance) and chmod +x it.
const TRANSPORT_BINARIES: Record<string, Record<string, string>> = {
  linux: { x64: 'index', arm64: 'index-arm64', arm: 'index-arm' },
};
const TRANSPORT_READY_TIMEOUT_MS = 20_000;

export const TRUEMONEY_HOST = 'gift.truemoney.com';

export const FIREFOX_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0';

// Firefox JA3 (TLS ClientHello) fingerprint. This is a current Firefox
// profile captured from real traffic (the same family the Go version's
// uTLS HelloFirefox_148 belongs to). Swap this string if TrueMoney
// starts fingerprinting a newer Firefox build.
export const FIREFOX_JA3 =
  '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0';

// Firefox HTTP/2 fingerprint: SETTINGS + priority order. The values keep
// the exact parity with the Go implementation: header table 65536,
// push off, initial window 131072, max frame 16384, MPAS priority.
export const FIREFOX_H2_FINGERPRINT =
  '1:65536;2:0;4:131072;5:16384|12517377|0|m,p,a,s';

export const FIREFOX_HEADER_ORDER = [
  'user-agent',
  'accept',
  'accept-language',
  'accept-encoding',
  'content-type',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
];

@Injectable()
export class CycletlsTruemoneyClient
  implements TruemoneyClient, OnModuleDestroy
{
  private readonly logger = new Logger('TruemoneyClient');
  private readonly jar = new CookieJar();
  private client?: CycleTLSClient;
  private initPromise?: Promise<CycleTLSClient>;

  // Lazy transport startup: the bundled Go child process is only spawned
  // on the first redeem. On serverless (Vercel) this keeps liveness probes
  // and validation-only requests free of the expensive cold-start
  // handshake; a failed spawn is retried on the next request.
  private ensureClient(): Promise<CycleTLSClient> {
    this.initPromise ??= this.startTransport();
    return this.initPromise;
  }

  private async startTransport(): Promise<CycleTLSClient> {
    try {
      const executablePath = await this.prepareExecutable();
      return await withTimeout(
        initCycleTLS({
          timeout: 15_000,
          ...(executablePath ? { executablePath } : {}),
        }),
        TRANSPORT_READY_TIMEOUT_MS,
        'browser-fingerprint transport did not become ready in time',
      );
    } catch (err) {
      this.logger.error(
        `failed to start browser-fingerprint transport: ${String(err)}`,
      );
      this.initPromise = undefined;
      throw err;
    }
  }

  // Returns the path of a spawnable binary copy (or undefined to let the
  // package use its bundled binary, which is fine on dev machines where
  // the exec bit survives). On serverless the copy lives in the writable
  // temp dir so chmod +x actually sticks.
  private async prepareExecutable(): Promise<string | undefined> {
    const binary = TRANSPORT_BINARIES[process.platform]?.[os.arch()];
    if (!binary) {
      return undefined;
    }
    const src = path.join(path.dirname(require.resolve('cycletls')), binary);
    const dest = path.join(os.tmpdir(), `truemoney-${binary}`);
    try {
      await fs.access(dest, fs.constants.X_OK);
      return dest; // already prepared on this instance
    } catch {
      await fs.copyFile(src, dest);
      await fs.chmod(dest, 0o755);
      return dest;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.exit();
      } catch {
        // The child process may already be gone during shutdown.
      }
    }
  }

  async post(
    url: string,
    options: TruemoneyRequestOptions,
  ): Promise<RawResponse> {
    this.client ??= await this.ensureClient();
    const resp = await this.client(
      url,
      {
        body: options.body,
        headers: options.headers,
        headerOrder: options.headerOrder,
        cookies: this.jar.forHost(TRUEMONEY_HOST),
        ja3: FIREFOX_JA3,
        http2Fingerprint: FIREFOX_H2_FINGERPRINT,
        userAgent: FIREFOX_USER_AGENT,
        timeout: options.timeoutSeconds,
        responseType: 'text',
      },
      'post',
    );

    this.jar.set(resp.headers['set-cookie'], TRUEMONEY_HOST);

    return {
      status: resp.status,
      headers: resp.headers,
      body: this.normalizeBody(resp),
    };
  }

  private normalizeBody(resp: CycleTLSResponse): string {
    const raw =
      typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
    return raw.slice(0, MAX_BODY_BYTES);
  }
}

// CycleTLS does not bound how long the spawn/ready handshake may take (a
// failed child process can leave the init promise pending forever), so
// enforce a deadline and surface a readable error instead of hanging the
// whole function invocation until the platform kills it.
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
