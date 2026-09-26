// next/image only optimizes hosts listed in next.config remotePatterns; covers on any other host
// (an admin-entered URL) are rendered unoptimized so they cannot crash the page.
export function isOptimizedCoverHost(url: string): boolean {
  try {
    return new URL(url).hostname === 'covers.openlibrary.org';
  } catch {
    return false;
  }
}
