import { LatencyRegistry, normalizePath } from './latency.registry';

describe('normalizePath', () => {
  it('maps the root route to "/"', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/')).toBe('/');
  });

  it('keeps parameter-free paths as-is', () => {
    expect(normalizePath('/status')).toBe('/status');
  });

  it('strips path parameters', () => {
    expect(normalizePath('/truemoney/:code/:mobile')).toBe('/truemoney');
  });
});

describe('LatencyRegistry', () => {
  it('keeps the last recorded value per path', () => {
    const registry = new LatencyRegistry();
    registry.record('/truemoney', 300);
    registry.record('/truemoney', 12);
    expect(registry.snapshot()).toEqual({ '/truemoney': 12 });
  });
});