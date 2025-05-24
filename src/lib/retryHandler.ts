import { DelugeErrorCode, DelugeFileSystemError } from "./delugeErrors";

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: DelugeErrorCode[];
}

const DEFAULT_RETRYABLE_ERRORS = [
  DelugeErrorCode.OUT_OF_MEMORY,
  DelugeErrorCode.DISK_ERROR,
  DelugeErrorCode.INTERNAL_ERROR,
];

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 100,
    backoffMultiplier = 2,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof DelugeFileSystemError) {
        if (!retryableErrors.includes(error.code)) {
          throw error; // Not retryable
        }
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
