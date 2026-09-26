export function formatBarcode(n: bigint | number): string {
  return `OB-${String(n).padStart(6, '0')}`;
}
