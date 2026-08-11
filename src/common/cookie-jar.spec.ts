import { CookieJar } from './cookie-jar';

describe('CookieJar', () => {
  it('stores and returns cookies for the request host', () => {
    const jar = new CookieJar();
    jar.set('cf_clearance=abc123; Path=/; Secure', 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({
      cf_clearance: 'abc123',
    });
  });

  it('does not leak cookies to other hosts', () => {
    const jar = new CookieJar();
    jar.set('session=xyz; Path=/', 'gift.truemoney.com');
    expect(jar.forHost('other.example.com')).toEqual({});
  });

  it('honors the Domain attribute', () => {
    const jar = new CookieJar();
    jar.set('cf_clearance=v; Domain=.truemoney.com', 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({
      cf_clearance: 'v',
    });
    expect(jar.forHost('api.truemoney.com')).toEqual({ cf_clearance: 'v' });
  });

  it('handles an array of Set-Cookie headers', () => {
    const jar = new CookieJar();
    jar.set(['a=1; Path=/', 'b=2; Path=/'], 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({ a: '1', b: '2' });
  });

  it('overwrites cookies with the same name and domain', () => {
    const jar = new CookieJar();
    jar.set('cf_clearance=old', 'gift.truemoney.com');
    jar.set('cf_clearance=new', 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({
      cf_clearance: 'new',
    });
  });

  it('removes expired cookies (empty value)', () => {
    const jar = new CookieJar();
    jar.set('cf_clearance=v', 'gift.truemoney.com');
    jar.set('cf_clearance=', 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({});
  });

  it('ignores garbage headers', () => {
    const jar = new CookieJar();
    jar.set('=novalue', 'gift.truemoney.com');
    expect(jar.forHost('gift.truemoney.com')).toEqual({});
  });
});
