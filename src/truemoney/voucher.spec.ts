import { mobileNumber, voucherCode } from './voucher';

describe('voucherCode', () => {
  it('accepts a raw alnum code', () => {
    expect(voucherCode('ABCD1234EFGH')).toBe('ABCD1234EFGH');
  });

  it('accepts dashes and underscores', () => {
    expect(voucherCode('AB-CD_EF-1234')).toBe('AB-CD_EF-1234');
  });

  it('trims surrounding whitespace', () => {
    expect(voucherCode('  ABCD1234EFGH  ')).toBe('ABCD1234EFGH');
  });

  it('extracts the code from a full campaign URL', () => {
    expect(
      voucherCode('https://gift.truemoney.com/campaign/?v=ABCD1234EFGH'),
    ).toBe('ABCD1234EFGH');
  });

  it('rejects empty input', () => {
    expect(() => voucherCode('')).toThrow();
    expect(() => voucherCode('   ')).toThrow();
  });

  it('rejects non-https URLs', () => {
    expect(() =>
      voucherCode('http://gift.truemoney.com/campaign/?v=X'),
    ).toThrow('invalid voucher URL');
  });

  it('rejects foreign hosts', () => {
    expect(() => voucherCode('https://evil.example.com/campaign/?v=X')).toThrow(
      'invalid voucher URL',
    );
  });

  it('rejects wrong paths', () => {
    expect(() => voucherCode('https://gift.truemoney.com/other/?v=X')).toThrow(
      'invalid voucher URL',
    );
  });

  it('rejects a URL without a v param', () => {
    expect(() => voucherCode('https://gift.truemoney.com/campaign/')).toThrow(
      'voucher code is required',
    );
  });

  it('rejects codes longer than 128 chars', () => {
    expect(() => voucherCode('A'.repeat(129))).toThrow('invalid voucher code');
  });

  it('accepts codes of exactly 128 chars', () => {
    expect(voucherCode('A'.repeat(128))).toHaveLength(128);
  });

  it('rejects illegal characters', () => {
    expect(() => voucherCode('AB CD')).toThrow('invalid voucher code');
    expect(() => voucherCode('AB/CD')).toThrow('invalid voucher code');
    expect(() => voucherCode('ไทย')).toThrow('invalid voucher code');
  });
});

describe('mobileNumber', () => {
  it('accepts a valid Thai mobile', () => {
    expect(mobileNumber('0812345678')).toBe('0812345678');
  });

  it('strips spaces and dashes', () => {
    expect(mobileNumber('08 123 456 78')).toBe('0812345678');
    expect(mobileNumber('08-1234-5678')).toBe('0812345678');
  });

  it('rejects numbers not starting with 0', () => {
    expect(() => mobileNumber('1812345678')).toThrow();
  });

  it('rejects wrong lengths', () => {
    expect(() => mobileNumber('081234567')).toThrow();
    expect(() => mobileNumber('08123456789')).toThrow();
  });

  it('rejects non-digit characters', () => {
    expect(() => mobileNumber('08a2345678')).toThrow();
  });
});
