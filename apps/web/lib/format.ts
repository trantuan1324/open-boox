const VND = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number): string {
  return `${VND.format(amount)} đ`;
}
