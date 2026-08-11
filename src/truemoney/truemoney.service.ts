import { Inject, Injectable, Logger } from '@nestjs/common';
import { ErrBadRequest, ErrInternal } from '../common/app-error';
import { maskCode } from '../common/mask';
import {
  REDEEM_PATH,
  TRUEMONEY_BASE_URL,
  TRUEMONEY_CLIENT,
} from './truemoney-client';
import type { TruemoneyClient } from './truemoney-client';
import { FIREFOX_HEADER_ORDER } from './truemoney-client.cycletls';
import { mobileNumber, voucherCode } from './voucher';

const REQUEST_TIMEOUT_SECONDS = 15;

// Successful redeem answers are cached in-process keyed by (code, mobile)
// for ten minutes, mirroring the Go version. A client that times out and
// retries replays the real answer of the first attempt instead of
// re-redeeming the voucher; error envelopes and transport failures are
// never cached. The cache is an LRU-ish Map: eviction drops the oldest
// INSERTED entry when at capacity.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 1024;

interface CacheEntry {
  body: string;
  ts: number;
}

@Injectable()
export class TruemoneyService {
  private readonly logger = new Logger('TruemoneyService');
  private readonly cache = new Map<string, CacheEntry>();
  // Single-flight: concurrent redeems of the same (code, mobile) share one
  // upstream call, so a retry storm cannot redeem the voucher twice.
  private readonly inflight = new Map<string, Promise<string>>();
  // Tunable for tests; defaults mirror the Go version (10 min / 1024).
  private cacheTtlMs = CACHE_TTL_MS;
  private cacheMax = CACHE_MAX_ENTRIES;

  constructor(
    @Inject(TRUEMONEY_CLIENT) private readonly client: TruemoneyClient,
  ) {}

  async redeem(voucher: string, phoneNumber: string): Promise<string> {
    let code: string;
    let mobile: string;
    try {
      code = voucherCode(voucher);
      mobile = mobileNumber(phoneNumber);
    } catch {
      throw ErrBadRequest();
    }

    const key = `${code}|${mobile}`;

    const cached = this.cacheGet(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending; // share the in-flight upstream call
    }

    const promise = this.doTruemoneyRedeem(code, mobile, key);
    this.inflight.set(key, promise);
    // Both branches delete the in-flight entry; the two-arg then() keeps
    // the derived promise from becoming an unhandled rejection.
    promise.then(
      () => this.inflight.delete(key),
      () => this.inflight.delete(key),
    );
    return promise;
  }

  private async doTruemoneyRedeem(
    code: string,
    mobile: string,
    key: string,
  ): Promise<string> {
    const body = JSON.stringify({ mobile });

    try {
      const resp = await this.client.post(
        TRUEMONEY_BASE_URL + REDEEM_PATH(code),
        {
          body,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://gift.truemoney.com/campaign/card',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
          },
          headerOrder: FIREFOX_HEADER_ORDER,
          timeoutSeconds: REQUEST_TIMEOUT_SECONDS,
        },
      );
      const raw = this.validJSON(resp.body, resp.status);
      if (isSuccessBody(raw)) {
        this.cacheSet(key, raw);
      }
      return raw;
    } catch (err) {
      this.logger.error(
        `redeem failed: ${(err as Error).message} code=${maskCode(code)}`,
      );
      throw ErrInternal();
    }
  }

  // Mirror of the Go client's validJSON(): TrueMoney answers domain errors
  // (e.g. TARGET_USER_NOT_FOUND) with HTTP 400 + a JSON "status" envelope,
  // so non-2xx bodies carrying that envelope pass through unchanged.
  // Anything else on a >=400 status -- Cloudflare challenges or upstream
  // errors without the envelope -- becomes an error. An empty 2xx body
  // becomes {}.
  private validJSON(raw: string, status: number): string {
    if (raw.length === 0) {
      if (status >= 200 && status < 300) {
        return '{}';
      }
      throw new Error(`TrueMoney returned HTTP ${status} with an empty body`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `TrueMoney returned HTTP ${status} with a non-JSON response: ${preview(raw)}`,
      );
    }

    if (status >= 400 && !isTrueMoneyEnvelope(parsed)) {
      throw new Error(
        `upstream returned HTTP ${status} without a TrueMoney status envelope: ${preview(raw)}`,
      );
    }

    return raw;
  }

  private cacheGet(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.ts > this.cacheTtlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.body;
  }

  private cacheSet(key: string, body: string): void {
    if (this.cache.size >= this.cacheMax) {
      // Evict the oldest inserted entry (first key of the Map).
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { body, ts: Date.now() });
  }
}

// isSuccessBody reports whether a raw TrueMoney answer is a SUCCESS
// envelope — the only answers that are cached (parity with the Go
// version). Never throws: a malformed body simply isn't cached.
function isSuccessBody(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'status' in parsed
    ) {
      const status = (parsed as { status: unknown }).status;
      return (
        typeof status === 'object' &&
        status !== null &&
        (status as { code?: unknown }).code === 'SUCCESS'
      );
    }
    return false;
  } catch {
    return false;
  }
}

function isTrueMoneyEnvelope(parsed: unknown): boolean {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'status' in parsed &&
    parsed.status !== undefined
  );
}

function preview(raw: string): string {
  return raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
}
