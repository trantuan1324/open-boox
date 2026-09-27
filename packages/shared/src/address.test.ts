import { describe, expect, it } from 'vitest';
import { addressInputSchema, PROVINCES, shippingFeeFor, zoneOf } from './address';

const valid = {
  recipientName: '  Nguyễn Văn A ',
  phone: '0912345678',
  line: '1 Tràng Tiền',
  ward: 'Phường Hoàn Kiếm',
  city: 'Hà Nội',
};

describe('PROVINCES', () => {
  it('lists the 34 provincial-level units after the 2025 merger, without duplicates', () => {
    expect(PROVINCES).toHaveLength(34);
    expect(new Set(PROVINCES).size).toBe(34);
    expect(PROVINCES).toContain('TP. Hồ Chí Minh');
    expect(PROVINCES).not.toContain('Hà Giang');
  });
});

describe('zoneOf / shippingFeeFor', () => {
  it('puts the warehouse city in INNER and charges 20.000 đ', () => {
    expect(zoneOf('Hà Nội')).toBe('INNER');
    expect(shippingFeeFor('Hà Nội')).toBe(20_000);
  });

  it('puts every other province in OUTER and charges 35.000 đ', () => {
    for (const city of PROVINCES.filter((c) => c !== 'Hà Nội')) {
      expect(zoneOf(city)).toBe('OUTER');
      expect(shippingFeeFor(city)).toBe(35_000);
    }
  });
});

describe('addressInputSchema', () => {
  it('trims text and accepts a province from the list', () => {
    const parsed = addressInputSchema.parse(valid);
    expect(parsed.recipientName).toBe('Nguyễn Văn A');
    expect(parsed.city).toBe('Hà Nội');
  });

  it('rejects a city outside the list, including pre-merger names', () => {
    for (const city of ['Hanoi', 'Hà Giang', '']) {
      const result = addressInputSchema.safeParse({ ...valid, city });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['city']);
    }
  });

  it('rejects a phone that is not 10 digits starting with 0', () => {
    expect(addressInputSchema.safeParse({ ...valid, phone: '912345678' }).success).toBe(false);
  });

  it('drops unknown keys such as zone and isDefault', () => {
    const parsed = addressInputSchema.parse({ ...valid, zone: 'INNER', isDefault: true });
    expect(parsed).not.toHaveProperty('zone');
    expect(parsed).not.toHaveProperty('isDefault');
  });
});
