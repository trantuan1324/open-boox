// Display code for admin tables (spec §6.2c): the last 8 characters of a cuid — its head is a timestamp, so
// rows created together would look alike. Links keep the full id.
export function shortCode(id: string): string {
  return id.slice(-8).toUpperCase();
}
