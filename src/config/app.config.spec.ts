import { DEFAULT_PORT, loadPort } from './app.config';

const OLD_ENV = process.env;

describe('loadPort', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.PORT;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('defaults to 3000 when PORT is unset', () => {
    expect(loadPort()).toBe(DEFAULT_PORT);
  });

  it('reads an explicitly set valid PORT', () => {
    process.env.PORT = '8080';
    expect(loadPort()).toBe(8080);
  });

  it('rejects non-numeric PORT', () => {
    process.env.PORT = 'abc';
    expect(() => loadPort()).toThrow(/invalid PORT/);
  });

  it('rejects PORT out of range', () => {
    process.env.PORT = '0';
    expect(() => loadPort()).toThrow(/invalid PORT/);
    process.env.PORT = '65536';
    expect(() => loadPort()).toThrow(/invalid PORT/);
  });
});
