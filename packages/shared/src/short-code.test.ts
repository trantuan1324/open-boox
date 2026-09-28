import { describe, expect, it } from 'vitest';
import { shortCode } from './short-code';

describe('shortCode', () => {
  it('takes the last 8 characters, upper-cased', () => {
    expect(shortCode('cmg1a2b3c0000abcd1234wxyz')).toBe('1234WXYZ');
  });

  it('tells apart ids created in the same instant (cuid heads are timestamps)', () => {
    expect(shortCode('cmg1a2b3c0000aaaa1111qqqq')).not.toBe(shortCode('cmg1a2b3c0000aaaa2222rrrr'));
  });
});
