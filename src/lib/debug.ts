import { debugLog } from '../state';
import { Signal } from '@preact/signals';

/**
 * Add a debug message to the log with timestamp
 */
export function addDebugMessage(message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  debugLog.value = [...debugLog.value, `[${timestamp}] ${message}`];
}

/**
 * Clear all debug messages
 */
export function clearDebug(): void {
  debugLog.value = [];
}

/**
 * Hook to access the debug log signal
 */
export function useDebugLog(): Signal<string[]> {
  return debugLog;
} 