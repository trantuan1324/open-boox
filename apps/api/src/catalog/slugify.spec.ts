import { slugify } from './slugify';

describe('slugify', () => {
  it.each([
    ['Nhà giả kim', 'nha-gia-kim'],
    ['Đắc Nhân Tâm', 'dac-nhan-tam'],
    ['  Sapiens: Lược sử loài người  ', 'sapiens-luoc-su-loai-nguoi'],
    ['Harry Potter & Hòn đá phù thủy', 'harry-potter-hon-da-phu-thuy'],
    ['1984', '1984'],
    ['!!!', 'sach'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
