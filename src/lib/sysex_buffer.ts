/**
 * SysEx Message Batching
 *
 * Reduces memory churn and CPU usage by batching consecutive SysEx message fragments
 * into single logical messages before dispatching to listeners.
 */

// Map of message IDs to pending fragments
const pending = new Map<number, Uint8Array[]>();

// Map of message IDs to timeout handles
const timeouts = new Map<number, number>();

// Get global window type for the debug flag
declare global {
  interface Window {
    DELUGE_NO_BUFFER?: boolean;
    ENABLE_SYSEX_BUFFER?: boolean;
  }
}

// Feature flag - can be controlled via environment or localStorage
const FEATURE_FLAG_KEY = "ENABLE_SYSEX_BUFFER";
// Default to enabled now that we have selective buffering
let featureFlagEnabled = true;

// Try to initialize from localStorage for persistence across reloads
try {
  featureFlagEnabled = localStorage.getItem(FEATURE_FLAG_KEY) === "true";
} catch {
  // Ignore localStorage errors
  console.warn("Could not access localStorage for SysEx buffer settings");
}

// Forward function to collect batched messages
let notifyListener: ((event: MIDIMessageEvent) => void) | null = null;

/**
 * Set a listener function to receive batched messages
 * @param listener Function to receive batched messages
 */
export function setBatchedMessageListener(
  listener: ((event: MIDIMessageEvent) => void) | null,
): void {
  notifyListener = listener;
}

/**
 * Check if buffering is enabled based on debug flag and feature flag
 */
const isBufferingEnabled = () => {
  // Debug override takes precedence
  if (window.DELUGE_NO_BUFFER) {
    return false;
  }

  // Then check global flag
  if (typeof window.ENABLE_SYSEX_BUFFER !== "undefined") {
    return window.ENABLE_SYSEX_BUFFER;
  }

  // Finally use the feature flag setting
  return featureFlagEnabled;
};

/**
 * Set the feature flag state and persist to localStorage
 * @param enabled Whether SysEx buffering should be enabled
 */
export function setSysExBufferEnabled(enabled: boolean): void {
  featureFlagEnabled = enabled;
  try {
    localStorage.setItem(FEATURE_FLAG_KEY, enabled.toString());
  } catch {
    console.warn("Could not save SysEx buffer setting to localStorage");
  }
}

/**
 * Get the current state of the feature flag
 */
export function isSysExBufferEnabled(): boolean {
  return isBufferingEnabled();
}

// Maximum buffer size before forcing a flush (64 KB)
const MAX_BUFFER_SIZE = 64 * 1024;

// Track if we're in the process of forwarding a batch
// to prevent infinite recursion
let isForwarding = false;

/**
 * Handle an incoming SysEx message fragment
 *
 * @param event MIDI message event containing a SysEx fragment
 */
export function handleFragment(event: MIDIMessageEvent): void {
  // Skip if not SysEx or buffering is disabled
  if (!event.data || event.data[0] !== 0xf0 || !isBufferingEnabled()) {
    return;
  }

  // Prevent reprocessing our own forwarded messages
  if (isForwarding) {
    return;
  }

  const data = new Uint8Array(event.data);

  // Determine message ID position based on manufacturer ID
  const isDevId = data[1] === 0x7d;
  const commandPos = isDevId ? 2 : 5;
  const msgIdPos = isDevId ? 3 : 6;

  // Not enough data for a valid message ID
  if (data.length <= msgIdPos) {
    return;
  }

  // Get command type and message ID
  const command = data[commandPos];
  const msgId = data[msgIdPos];

  // ONLY buffer file transfer messages (command type 0x04 = JSON)
  // AND first payload byte is 0x7B ('{' character for JSON)
  // This ensures we only buffer file transfer data and not screen/debug/status messages
  if (command !== 0x04) {
    return;
  }

  // Check for JSON start character to ensure it's a data transfer message
  const payloadStartPos = msgIdPos + 1;
  if (data.length <= payloadStartPos || data[payloadStartPos] !== 0x7b) {
    return;
  }

  // Get or create fragment array for this message ID
  if (!pending.has(msgId)) {
    pending.set(msgId, []);
  }

  // Add fragment to pending list
  const fragments = pending.get(msgId)!;
  fragments.push(data);

  // Check if this is the final fragment (ends with 0xF7)
  const isComplete = data[data.length - 1] === 0xf7;

  // Check if we've exceeded the buffer size limit
  let totalSize = 0;
  for (const fragment of fragments) {
    totalSize += fragment.length;
  }

  // Force flush if size limit exceeded or message is complete
  if (isComplete || totalSize > MAX_BUFFER_SIZE) {
    flushMessage(msgId);
  } else {
    // Restart the flush timer
    if (timeouts.has(msgId)) {
      window.clearTimeout(timeouts.get(msgId));
    }

    // Set new timeout (16ms ≈ 1 frame)
    timeouts.set(
      msgId,
      window.setTimeout(() => flushMessage(msgId), 16),
    );
  }
}

/**
 * Flush a pending message by combining all fragments and broadcasting
 *
 * @param msgId The message ID to flush
 */
function flushMessage(msgId: number): void {
  // Cancel any pending timeout
  if (timeouts.has(msgId)) {
    window.clearTimeout(timeouts.get(msgId));
    timeouts.delete(msgId);
  }

  // Get fragments for this message ID
  const fragments = pending.get(msgId);
  if (!fragments || fragments.length === 0) {
    return;
  }

  // Clear the pending fragments
  pending.delete(msgId);

  // If only one fragment, no need to concatenate
  if (fragments.length === 1) {
    // Just forward the original message
    broadcastMessage(fragments[0]);
    return;
  }

  // Calculate total size and create combined buffer
  let totalSize = 0;
  for (const fragment of fragments) {
    totalSize += fragment.length;
  }

  const combined = new Uint8Array(totalSize);

  // Copy all fragments into the combined buffer
  let offset = 0;
  for (const fragment of fragments) {
    combined.set(fragment, offset);
    offset += fragment.length;
  }

  // Broadcast the combined message
  broadcastMessage(combined);
}

/**
 * Forward a SysEx message to the smsysex system by creating a MIDIMessageEvent-like object
 *
 * @param data The complete SysEx message
 */
function broadcastMessage(data: Uint8Array): void {
  try {
    // Set flag to prevent reprocessing
    isForwarding = true;

    // DO NOT call handleSysexMessage directly
    // Instead, we'll create a synthetic event and notify our registered listeners
    const syntheticEvent = {
      data: data,
    } as unknown as MIDIMessageEvent;

    // If a listener is registered, notify it
    if (notifyListener) {
      notifyListener(syntheticEvent);
    }
  } finally {
    // Always clear the forwarding flag
    isForwarding = false;
  }
}

/**
 * Flush all pending messages immediately
 * This is useful when cancelling operations to ensure no lingering data
 */
export function flushAllMessages(): void {
  // Get all active message IDs
  const messageIds = Array.from(pending.keys());

  // Flush each message
  messageIds.forEach(flushMessage);

  // Clear all timeouts
  timeouts.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });

  // Clear the maps
  timeouts.clear();
  pending.clear();
}

/**
 * Debug function to get the current number of pending messages
 * @returns Object with counts of pending message IDs and fragments
 */
export function getBufferStats(): { messageIds: number; fragments: number } {
  let fragmentCount = 0;
  for (const fragments of pending.values()) {
    fragmentCount += fragments.length;
  }

  return {
    messageIds: pending.size,
    fragments: fragmentCount,
  };
}
