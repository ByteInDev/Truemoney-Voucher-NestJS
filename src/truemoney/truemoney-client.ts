export interface RawResponse {
  status: number;
  headers: Record<string, unknown>;
  body: string;
}

export interface TruemoneyRequestOptions {
  body: string;
  headers: Record<string, string>;
  headerOrder: string[];
  timeoutSeconds: number;
}

export interface TruemoneyClient {
  post(url: string, options: TruemoneyRequestOptions): Promise<RawResponse>;
  shutdown(): Promise<void>;
}

export const TRUEMONEY_CLIENT = Symbol('TRUEMONEY_CLIENT');

export const TRUEMONEY_BASE_URL = 'https://gift.truemoney.com';

export const REDEEM_PATH = (code: string): string =>
  `/campaign/vouchers/${code}/redeem`;

export const MAX_BODY_BYTES = 2 << 20;
