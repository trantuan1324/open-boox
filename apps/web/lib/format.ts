const VND = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number): string {
  return `${VND.format(amount)} đ`;
}

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
