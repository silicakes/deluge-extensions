import * as midiLib from "@/lib/midi";

/**
 * Stop polling display data.
 */
export const stopMonitor: () => void =
  midiLib.stopMonitor ??
  (() => {
    /* no-op if underlying implementation is unavailable */
  });
