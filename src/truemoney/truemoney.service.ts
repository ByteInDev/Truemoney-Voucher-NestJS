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

@Injectable()
export class TruemoneyService {
  private readonly logger = new Logger('TruemoneyService');

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
      return this.validJSON(resp.body, resp.status);
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
