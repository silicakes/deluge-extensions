import { startPolling } from "@/lib/display";

/**
 * Start polling display data at 1s intervals.
 */
export const startMonitor: () => void = startPolling;
