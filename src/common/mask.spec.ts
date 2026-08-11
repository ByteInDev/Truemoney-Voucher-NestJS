import { maskCode } from './mask';

describe('maskCode', () => {
  it('masks short codes entirely', () => {
    expect(maskCode('ABC')).toBe('****');
    expect(maskCode('ABCD1234')).toBe('****');
  });

  it('keeps first and last four characters', () => {
    expect(maskCode('ABCD1234EFGH')).toBe('ABCD****EFGH');
  });

  it('handles exactly 9 characters', () => {
    expect(maskCode('ABCD12345')).toBe('ABCD****2345');
  });
});
