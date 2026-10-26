import 'server-only';

/**
 * Wall-clock time for the current request. Server components here render per request
 * (nothing is cached), so reading the clock once per render is intentional.
 */
export function requestTime(): number {
  return Date.now();
}
