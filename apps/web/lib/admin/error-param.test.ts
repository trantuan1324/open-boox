import { describe, expect, it } from 'vitest';
import { errorFromParam, withError } from './error-param';

describe('errorFromParam', () => {
  it('reads a known error code', () => {
    expect(errorFromParam('LOAN_NOT_CANCELLABLE')).toBe('LOAN_NOT_CANCELLABLE');
    expect(errorFromParam(['SHIPMENT_ALREADY_RETRIED', 'X'])).toBe('SHIPMENT_ALREADY_RETRIED');
  });

  it.each([undefined, '', 'abc', '<script>'])('ignores %j', (value) => {
    expect(errorFromParam(value)).toBeNull();
  });
});

describe('withError', () => {
  it('puts the code in the query string', () => {
    expect(withError('/admin/shipments/s1', 'INVALID_SHIPMENT_TRANSITION')).toBe(
      '/admin/shipments/s1?error=INVALID_SHIPMENT_TRANSITION',
    );
  });
});
