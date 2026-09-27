import { z } from 'zod';
import { phoneSchema } from './auth';

// The 34 provincial-level units after the July 2025 merger: 6 centrally-run cities, then 28 provinces.
export const PROVINCES = [
  'Hà Nội',
  'Huế',
  'Hải Phòng',
  'Đà Nẵng',
  'TP. Hồ Chí Minh',
  'Cần Thơ',
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Tĩnh',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tuyên Quang',
  'Vĩnh Long',
] as const;
export type Province = (typeof PROVINCES)[number];

export type Zone = 'INNER' | 'OUTER';
export const WAREHOUSE_PROVINCE: Province = 'Hà Nội';
export const SHIPPING_FEES: Record<Zone, number> = { INNER: 20_000, OUTER: 35_000 };

// Zone is derived, never stored or sent by the client (spec §3.1).
export function zoneOf(city: Province): Zone {
  return city === WAREHOUSE_PROVINCE ? 'INNER' : 'OUTER';
}

export function shippingFeeFor(city: Province): number {
  return SHIPPING_FEES[zoneOf(city)];
}

export const addressInputSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên người nhận')
    .max(100, 'Tên người nhận tối đa 100 ký tự'),
  phone: phoneSchema,
  line: z.string().trim().min(1, 'Vui lòng nhập số nhà, đường').max(200, 'Địa chỉ tối đa 200 ký tự'),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã').max(100, 'Phường/xã tối đa 100 ký tự'),
  city: z.enum(PROVINCES, { error: 'Vui lòng chọn tỉnh/thành' }),
});
export type AddressInput = z.output<typeof addressInputSchema>;

// Type aliases (not interfaces) so the snapshot is assignable to Prisma's JSON input type.
export type AddressSnapshot = {
  recipientName: string;
  phone: string;
  line: string;
  ward: string;
  city: Province;
};
export type AddressDto = AddressSnapshot & { id: string; isDefault: boolean };
