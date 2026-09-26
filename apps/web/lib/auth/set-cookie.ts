export function parseSetCookie(raw: string): { name: string; value: string } | null {
  const pair = raw.split(';', 1)[0] ?? '';
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
}
