import * as midiLib from "@/lib/midi";

/**
 * Start polling display data at 1s intervals.
 */
export const startMonitor: () => void =
  midiLib.startMonitor ??
  (() => {
    /* no-op if underlying implementation is unavailable */
  });
