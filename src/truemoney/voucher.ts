const MAX_VOUCHER_LENGTH = 128;

export function voucherCode(raw: string): string {
  let voucher = raw.trim();
  if (voucher === '') {
    throw new Error('voucher code is required');
  }

  if (voucher.includes('://')) {
    let parsed: URL;
    try {
      parsed = new URL(voucher);
    } catch {
      throw new Error('invalid voucher URL');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname.toLowerCase() !== 'gift.truemoney.com' ||
      parsed.pathname !== '/campaign/'
    ) {
      throw new Error('invalid voucher URL');
    }
    voucher = parsed.searchParams.get('v') ?? '';
  }

  if (voucher.length > MAX_VOUCHER_LENGTH) {
    throw new Error('invalid voucher code');
  }
  if (voucher === '') {
    throw new Error('voucher code is required');
  }

  for (const char of voucher) {
    const c = char.charCodeAt(0);
    const isAlpha = (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
    const isDigit = c >= 48 && c <= 57;
    if (!isAlpha && !isDigit && char !== '-' && char !== '_') {
      throw new Error('invalid voucher code');
    }
  }

  return voucher;
}

export function mobileNumber(raw: string): string {
  const phone = raw.trim().replace(/[\s-]/g, '');
  if (phone.length !== 10 || phone[0] !== '0') {
    throw new Error('mobile number must contain 10 digits and start with 0');
  }
  for (const char of phone) {
    if (char < '0' || char > '9') {
      throw new Error('mobile number must contain 10 digits and start with 0');
    }
  }
  return phone;
}
