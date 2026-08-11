interface StoredCookie {
  name: string;
  value: string;
  domain: string;
}

export class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  set(setCookieHeader: unknown, requestHost: string): void {
    if (!setCookieHeader) {
      return;
    }
    const headers = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];
    for (const raw of headers) {
      this.setOne(String(raw), requestHost);
    }
  }

  forHost(host: string): Record<string, string> {
    const target = host.toLowerCase();
    const out: Record<string, string> = {};
    for (const { name, value, domain } of this.cookies.values()) {
      if (target === domain || target.endsWith('.' + domain)) {
        out[name] = value;
      }
    }
    return out;
  }

  private setOne(header: string, requestHost: string): void {
    const parts = header
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) {
      return;
    }

    const eq = parts[0].indexOf('=');
    if (eq <= 0) {
      return;
    }
    const name = parts[0].slice(0, eq).trim();
    const value = parts[0].slice(eq + 1).trim();

    let domain = requestHost.toLowerCase();
    for (const attr of parts.slice(1)) {
      const [k, ...rest] = attr.split('=').map((s) => s.trim());
      if (k.toLowerCase() === 'domain' && rest.length > 0) {
        domain = rest.join('=').replace(/^\./, '').toLowerCase();
        break;
      }
    }

    const key = `${domain}:${name}`;
    if (value === '') {
      this.cookies.delete(key);
      return;
    }
    this.cookies.set(key, { name, value, domain });
  }
}
