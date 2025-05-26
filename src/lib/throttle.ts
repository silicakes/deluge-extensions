/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified interval. The first call happens immediately,
 * and subsequent calls are delayed until the interval has passed.
 *
 * @param func Function to throttle
 * @param wait Minimum milliseconds between invocations (default: 120ms)
 * @returns Throttled function
 */
export function throttle<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number = 120,
): (...args: Args) => void {
  let lastCallTime = 0;
  let timeout: number | null = null;
  let lastArgs: Args | null = null;

  return function (this: unknown, ...args: Args): void {
    const now = Date.now();

    // If this is the first call, or wait time has elapsed, execute immediately
    if (now - lastCallTime >= wait) {
      lastCallTime = now;
      func.apply(this, args);
    } else {
      // Store the latest arguments for delayed execution
      lastArgs = args;

      // Only set timeout once
      if (timeout === null) {
        timeout = window.setTimeout(
          () => {
            if (lastArgs) {
              const callTime = Date.now();
              lastCallTime = callTime;
              func.apply(this, lastArgs);
            }
            timeout = null;
            lastArgs = null;
          },
          wait - (now - lastCallTime),
        );
      }
    }
  };
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last time it was invoked.
 *
 * @param func Function to debounce
 * @param wait Milliseconds to delay (default: 300ms)
 * @returns Debounced function
 */
export function debounce<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number = 300,
): (...args: Args) => void {
  let timeout: number | null = null;

  return function (this: unknown, ...args: Args): void {
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }

    timeout = window.setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  };
}
