import { debugLog } from "../state";
import { Signal } from "@preact/signals";

// Maximum number of debug log entries to keep
const MAX_DEBUG_LOG_SIZE = 500;

// Global control for verbose logging
declare global {
  interface Window {
    DELUGE_LOG_VERBOSE?: boolean;
  }
}

/**
 * Check if the console drawer is open
 * This is used to determine if we should log verbose messages
 */
const isConsoleVisible = (): boolean => {
  // The SysExConsole sets a data attribute on the drawer element when it's open
  const consoleDrawer = document.querySelector('[data-console-open="true"]');
  return !!consoleDrawer;
};

/**
 * Check if verbose logging is enabled
 */
const isVerboseLoggingEnabled = (): boolean => {
  return window.DELUGE_LOG_VERBOSE === true;
};

/**
 * Add a debug message to the log with timestamp
 */
export function addDebugMessage(message: string): void {
  // Skip logging raw SysEx data when the console is closed and verbose mode is off
  // This is a cheap bailout to avoid processing SysEx dumps when not needed
  if (
    message.startsWith("SysEx received:") &&
    !isVerboseLoggingEnabled() &&
    !isConsoleVisible()
  ) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();

  // Cap the debug log size
  if (debugLog.value.length >= MAX_DEBUG_LOG_SIZE) {
    // Remove the oldest entry before adding a new one
    debugLog.value = [...debugLog.value.slice(1), `[${timestamp}] ${message}`];
  } else {
    // Just append when under the limit
    debugLog.value = [...debugLog.value, `[${timestamp}] ${message}`];
  }
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

/**
 * Enable or disable verbose logging
 */
export function setVerboseLogging(enabled: boolean): void {
  window.DELUGE_LOG_VERBOSE = enabled;
}

/**
 * Check if verbose logging is currently enabled
 */
export function getVerboseLoggingState(): boolean {
  return isVerboseLoggingEnabled();
}
