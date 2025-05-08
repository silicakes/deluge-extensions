import {
  midiIn,
  midiOut,
  fileTree,
  FileEntry,
  fileTransferInProgress,
  fileTransferProgress,
  expandedPaths,
  selectedPaths,
  activeFileTransfers,
  FileTransfer,
  fileTransferQueue,
  TransferItem,
  anyTransferInProgress,
} from "../state";
import { addDebugMessage } from "./debug";
import {
  ensureSession,
  handleSysexMessage,
  ping as smsPing,
  sendJson,
  setDeveloperIdMode,
} from "./smsysex";
import {
  fileOverrideConfirmationOpen,
  filesToOverride,
  confirmCallback,
} from "../components/FileOverrideConfirmation";
// Re-enable buffering with improved filter conditions
import {
  handleFragment,
  setBatchedMessageListener,
  flushAllMessages,
} from "./sysex_buffer";
// Near the top of the file, import the throttle utility
import { throttle } from "./throttle";
import { encode7Bit as sharedEncode7Bit } from "@/commands/_shared/pack";

let midiAccess: MIDIAccess | null = null;
let monitorInterval: number | null = null;

// Re-enable batched message handling
setBatchedMessageListener((event) => {
  // When receiving a batched message, process it through the normal SysEx handler
  handleSysexMessage(event);
});

// Variable to track if a transfer should be cancelled
let cancelTransferRequested = false;

// Add tracking for batch uploads
let currentBatchUploadedFiles: string[] = [];

// Map of file IDs to cancellation status
const filesToCancel = new Set<string>();

// Generate a unique ID for file transfers
function generateTransferId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Update file transfer speed
function updateFileTransferSpeed(
  transferId: string,
  newBytes: number,
  lastBytes: number,
  timeDiff: number,
): void {
  // Find the transfer
  const transfers = [...activeFileTransfers.value];
  const index = transfers.findIndex((t) => t.id === transferId);
  if (index === -1) return;

  // Calculate speed (bytes per second)
  const bytesDiff = newBytes - lastBytes;
  const bytesPerSecond = bytesDiff / (timeDiff / 1000);

  // Only update if we have a meaningful measurement
  if (bytesPerSecond > 0) {
    transfers[index].speed = bytesPerSecond;
    activeFileTransfers.value = transfers;
  }
}

const SYSEX_COMMANDS = {
  PING: [0xf0, 0x7d, 0x00, 0xf7],
  GET_OLED: [0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7],
  GET_7SEG: [0xf0, 0x7d, 0x02, 0x01, 0x00, 0xf7],
  GET_DISPLAY: [0xf0, 0x7d, 0x02, 0x00, 0x02, 0xf7],
  GET_DISPLAY_FORCE: [0xf0, 0x7d, 0x02, 0x00, 0x03, 0xf7],
  FLIP: [0xf0, 0x7d, 0x02, 0x00, 0x04, 0xf7],
  GET_DEBUG: [0xf0, 0x7d, 0x03, 0x00, 0x01, 0xf7],
  GET_FEATURES: [0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7],
  GET_VERSION: [0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7],
};

const sendSysEx = (command: keyof typeof SYSEX_COMMANDS) => {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send SysEx command.");
    return;
  }
  midiOut.value.send(SYSEX_COMMANDS[command]);
};

// Observer pattern so other modules can react to raw MIDI data (e.g. DisplayViewer)
const midiListeners = new Set<(e: MIDIMessageEvent) => void>();

/** Initialize Web MIDI access and set up event listeners */
export async function initMidi(
  autoConnect: boolean = false,
): Promise<MIDIAccess | null> {
  if (!navigator.requestMIDIAccess) {
    console.error("Web MIDI API not supported");
    return null;
  }
  midiAccess = await navigator.requestMIDIAccess({ sysex: true });
  midiAccess.onstatechange = handleStateChange;
  updateDeviceLists();
  if (autoConnect) {
    autoConnectDefaultPorts();
  }
  return midiAccess;
}

/** Update the lists of inputs and outputs in state signals */
function updateDeviceLists() {
  if (!midiAccess) return;
  // nothing: component reads lists directly via midiAccess.inputs/outputs
}

/** Set MIDI input, updating signal and side-effects */
export function setMidiInput(input: MIDIInput | null) {
  if (midiIn.value === input) return;
  if (midiIn.value) {
    midiIn.value.removeEventListener("midimessage", handleMidiMessage);
  }
  midiIn.value = input;
  if (input) {
    input.addEventListener("midimessage", handleMidiMessage);
  }
}

/** Set MIDI output, updating signal */
export function setMidiOutput(output: MIDIOutput | null) {
  midiOut.value = output;
}

/** Handle hot-plug state changes */
function handleStateChange() {
  updateDeviceLists();
}

/** Auto-connect logic: pick first available ports matching 'Deluge' when autoConnect is true */
export function autoConnectDefaultPorts() {
  if (!midiAccess) return;
  for (const input of midiAccess.inputs.values()) {
    if (input.name?.includes("Deluge Port 3")) {
      setMidiInput(input);
      break;
    }
  }
  for (const output of midiAccess.outputs.values()) {
    if (output.name?.includes("Deluge Port 3")) {
      setMidiOutput(output);
      break;
    }
  }
}

/**
 * Select both input and output MIDI devices that include the word 'deluge'
 * This function is used for the numeric shortcuts (1,2,3) to quickly select Deluge devices
 * @param index The index of the Deluge device to select (0-based)
 * @returns True if a device was found and selected, false otherwise
 */
export function selectDelugeDevice(index: number): boolean {
  if (!midiAccess) return false;

  // Get all available MIDI devices that include 'deluge' (case insensitive)
  const delugeInputs = Array.from(midiAccess.inputs.values()).filter((input) =>
    input.name?.toLowerCase().includes("deluge"),
  );

  const delugeOutputs = Array.from(midiAccess.outputs.values()).filter(
    (output) => output.name?.toLowerCase().includes("deluge"),
  );

  // Check if we have a device at the requested index
  if (
    index < 0 ||
    index >= delugeInputs.length ||
    index >= delugeOutputs.length
  ) {
    console.log(`No Deluge device found at index ${index}`);
    return false;
  }

  // Set both input and output to the selected device
  setMidiInput(delugeInputs[index]);
  setMidiOutput(delugeOutputs[index]);

  console.log(
    `Selected Deluge device ${index + 1}: ${delugeInputs[index].name}`,
  );
  return true;
}

/** MIDI message handler – re-export or use event emitter if needed */
export function subscribeMidiListener(listener: (e: MIDIMessageEvent) => void) {
  midiListeners.add(listener);
  return () => midiListeners.delete(listener);
}

function handleMidiMessage(event: MIDIMessageEvent) {
  // Check if it's a SysEx message first (optimization)
  if (event.data && event.data.length > 0 && event.data[0] === 0xf0) {
    // Re-enable: Try to buffer the message (only for data transfer messages)
    handleFragment(event);

    // Directly call handleSysexMessage for all messages
    handleSysexMessage(event);

    // Forward to regular MIDI listeners
    midiListeners.forEach((fn) => fn(event));

    const bytes = Array.from(event.data)
      .map((b) => "0x" + b.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
    // If this is a debug message from the Deluge (category 0x03)
    if (
      event.data.length > 2 &&
      event.data[1] === 0x7d &&
      event.data[2] === 0x03
    ) {
      // Check if data length is enough to contain text (at least 7 bytes including F0, mfr ID, etc)
      if (event.data.length > 6) {
        try {
          // Extract ASCII text starting from position 5 (after SysEx header and command)
          const textBytes = event.data.slice(5, event.data.length - 1); // Exclude F7 at the end
          const text = String.fromCharCode.apply(null, Array.from(textBytes));
          addDebugMessage(`Message from Deluge: ${text}`);
        } catch {
          addDebugMessage(`Debug message received (binary): ${bytes}`);
        }
      } else {
        addDebugMessage(`Debug message received: ${bytes}`);
      }
    } else {
      // For other SysEx messages, just log the raw data
      addDebugMessage(`SysEx received: ${bytes}`);
    }
  } else {
    // For non-SysEx messages, forward directly to listeners
    midiListeners.forEach((fn) => fn(event));
  }
}

/** Get current MIDI inputs */
export function getMidiInputs(): MIDIInput[] {
  return midiAccess ? Array.from(midiAccess.inputs.values()) : [];
}

/** Get current MIDI outputs */
export function getMidiOutputs(): MIDIOutput[] {
  return midiAccess ? Array.from(midiAccess.outputs.values()) : [];
}

/** Send ping test command to Deluge */
export function ping() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send ping command.");
    return;
  }

  // Try using smSysex ping (new protocol)
  smsPing().catch((err) => {
    console.warn("smSysex ping failed, falling back to legacy ping:", err);
    // Fallback to legacy ping
    if (midiOut.value) {
      midiOut.value.send([0xf0, 0x7d, 0x00, 0xf7]);
    }
  });
}

/** Request full OLED display data */
export function getOled() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send OLED command.");
    return;
  }
  midiOut.value.send([0xf0, 0x7d, 0x02, 0x00, 0x01, 0xf7]);
}

/** Request full 7-segment display data */
export function get7Seg() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send 7-seg command.");
    return;
  }
  sendSysEx("GET_7SEG");
}

/** Flip the screen orientation */
export function flipScreen() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send flip-screen command.");
    return;
  }
  sendSysEx("FLIP");
}

/** Request raw display update (force full or delta) */
export function getDisplay(force: boolean = false) {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send display command.");
    return;
  }
  const command = force ? "GET_DISPLAY_FORCE" : "GET_DISPLAY";
  sendSysEx(command);
}

/** Request debug messages from device */
export function getDebug() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send debug command.");
    addDebugMessage("MIDI Output not selected. Cannot request debug messages.");
    return false;
  }
  sendSysEx("GET_DEBUG");
  addDebugMessage("Requested debug messages from device");
  return true;
}

/** Request features status from device */
export function getFeatures() {
  if (!midiOut.value) {
    console.error(
      "MIDI Output not selected. Cannot send features status command.",
    );
    addDebugMessage(
      "MIDI Output not selected. Cannot request features status.",
    );
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x01, 0x01, 0xf7]);
  addDebugMessage("Requested features status from device");
  return true;
}

/** Request version information from device */
export function getVersion() {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send version command.");
    addDebugMessage("MIDI Output not selected. Cannot request version info.");
    return false;
  }
  midiOut.value.send([0xf0, 0x7d, 0x03, 0x02, 0x01, 0xf7]);
  addDebugMessage("Requested version info from device");
  return true;
}

/**
 * Send a custom SysEx command to the Deluge
 * @param hexString A space-separated hex string, must start with F0 and end with F7
 * @returns true if sent successfully, false otherwise
 */
export function sendCustomSysEx(hexString: string): boolean {
  if (!midiOut.value) {
    console.error("MIDI Output not selected. Cannot send custom SysEx.");
    addDebugMessage("MIDI Output not selected. Cannot send command.");
    return false;
  }

  if (!hexString.trim()) {
    console.error("ERROR: Please enter a valid SysEx command");
    addDebugMessage("ERROR: Please enter a valid SysEx command");
    return false;
  }

  try {
    // Parse hex string into bytes
    const parts = hexString.trim().split(/\s+/);
    const bytes = parts.map((p) => parseInt(p, 16));

    if (bytes.some(isNaN)) {
      throw new Error("Invalid hex values");
    }

    // Ensure it starts with F0 and ends with F7
    if (bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
      throw new Error("SysEx must start with F0 and end with F7");
    }

    midiOut.value.send(bytes);
    addDebugMessage(`Sent: ${parts.join(" ")}`);
    return true;
  } catch (e) {
    console.error("Error sending SysEx", e);
    if (e instanceof Error) {
      addDebugMessage(`ERROR: ${e.message}`);
    }
    return false;
  }
}

/** Start polling display data at 1s intervals */
export function startMonitor() {
  if (monitorInterval !== null) return;
  getDisplay(true);
  monitorInterval = window.setInterval(() => getDisplay(false), 1000);
}

/** Stop polling display data */
export function stopMonitor() {
  if (monitorInterval !== null) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

/**
 * Test SysEx connectivity to ensure the device supports file browser commands
 * @returns Promise resolving to true if connected successfully
 */
export async function testSysExConnectivity(): Promise<boolean> {
  if (!midiOut.value) {
    console.error("testSysExConnectivity: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log("Testing SysEx connectivity...");

  let connected = false;

  // Try basic ping commands with liberal timeout periods
  try {
    // First try direct ping command
    console.log("Sending direct ping command");
    if (midiOut.value) {
      // Send a basic F0 7D 00 F7 ping command
      midiOut.value.send([0xf0, 0x7d, 0x00, 0xf7]);

      // Wait for a response or timeout
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("Basic ping command sent successfully");
      connected = true;
    }
  } catch (err) {
    console.warn("Basic ping failed, trying JSON protocol:", err);
  }

  // If basic ping succeeded, try to establish a proper session
  if (connected) {
    try {
      // Next try establishing a session
      console.log("Attempting to establish a session...");

      // Use setDeveloperIdMode to ensure we're using the simplest protocol
      setDeveloperIdMode(true);

      // Try to establish a session - this might fail but we've already verified basic connectivity
      try {
        await ensureSession();
        console.log("Session established successfully");
      } catch (sessionErr) {
        console.warn(
          "Session negotiation failed but basic connectivity works:",
          sessionErr,
        );
        // Continue anyway since we have basic connectivity
      }

      return true;
    } catch (err) {
      console.error(
        "Failed to establish proper session after basic ping succeeded:",
        err,
      );
      // Still return true because basic connectivity works
      return true;
    }
  }

  // Try with developer ID if the first attempts failed
  try {
    console.log("Switching to developer ID (0x7D)");
    setDeveloperIdMode(true);

    // Send a direct ping and look for any response
    midiOut.value.send([0xf0, 0x7d, 0x00, 0xf7]);
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Developer ID ping succeeded");
    return true;
  } catch (devErr) {
    console.error("All connectivity tests failed:", devErr);
    // Reset to standard mode
    setDeveloperIdMode(false);
    throw new Error("Device doesn't support file system SysEx communication");
  }
}

/**
 * Helper function to check if an entry is a directory based on its attribute flags
 * @param entry FileEntry to check
 * @returns true if the entry is a directory
 */
function isDirectory(entry: FileEntry): boolean {
  return (entry.attr & 0x10) !== 0;
}

/**
 * Sort file entries with directories first, then alphabetically
 * @param entries Array of FileEntry objects to sort
 * @returns Sorted array with directories first, then files (both alphabetically)
 */
function sortEntriesByDirectoryFirst(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = isDirectory(a);
    const bIsDir = isDirectory(b);

    // If types are different, directories come first
    if (aIsDir !== bIsDir) {
      return aIsDir ? -1 : 1;
    }

    // If both are the same type, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * List contents of a directory on the Deluge
 * @param path Directory path to list
 * @param options Optional options object
 * @returns Promise resolving to array of FileEntry objects
 */
export async function listDirectory(
  path: string,
  options?: { offset?: number; lines?: number; force?: boolean },
): Promise<FileEntry[]> {
  if (!midiOut.value) {
    console.error("listDirectory: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  const offset = options?.offset ?? 0;
  const lines = options?.lines ?? 64;
  const force = options?.force ?? false;

  console.log(
    `Listing directory ${path} (offset=${offset}, lines=${lines}, force=${force})...`,
  );

  // Retry logic for directory listing
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      // Ensure path starts with /
      if (!path.startsWith("/")) {
        path = "/" + path;
      }

      // Use smSysex transport to send the dir command
      console.log("Sending dir command via smSysex...");

      // Try to establish a session first (might already exist)
      try {
        await ensureSession();
      } catch (sessionErr) {
        console.warn(
          "Session establishment failed, but continuing with directory listing:",
          sessionErr,
        );
      }

      // Send the directory listing command
      const response = await sendJson({
        dir: {
          path,
          offset,
          lines,
          force,
        },
      });

      console.log("Received directory response:", response);

      // Parse the response
      if (
        response &&
        response["^dir"] &&
        typeof response["^dir"] === "object" &&
        response["^dir"] !== null &&
        "list" in response["^dir"]
      ) {
        const dirResponse = response["^dir"] as Record<string, unknown>;
        const entries = dirResponse.list as FileEntry[];

        console.log(`Found ${entries.length} entries in ${path}`);

        // Sort entries with directories first before updating state
        // We sort here to ensure consistency even when not rendered yet
        const sortedEntries = sortEntriesByDirectoryFirst(entries);

        // Update our fileTree signal with the new sorted data
        // Make a deep copy of the current fileTree to ensure reactivity
        const newFileTree = { ...fileTree.value };
        newFileTree[path] = sortedEntries;
        fileTree.value = newFileTree;

        console.log(
          `Updated fileTree with ${sortedEntries.length} entries for ${path}`,
        );
        return sortedEntries;
      } else if (
        response &&
        response["^dir"] &&
        typeof response["^dir"] === "object"
      ) {
        // Empty directory response
        console.log(`Directory ${path} is empty`);
        const newFileTree = { ...fileTree.value };
        newFileTree[path] = [];
        fileTree.value = newFileTree;
        return [];
      } else {
        // If we get here, but have a successful response with unexpected format
        // Instead of failing, try to extract any directory data possible
        console.warn("Unexpected directory response format:", response);

        if (response && typeof response === "object") {
          // Look for any key that might contain directory information
          for (const key of Object.keys(response)) {
            const value = response[key];
            if (value && typeof value === "object" && "list" in value) {
              console.log(`Found list data in key ${key}`);
              const entries = value.list as FileEntry[];
              const sortedEntries = sortEntriesByDirectoryFirst(entries);

              // Update fileTree
              const newFileTree = { ...fileTree.value };
              newFileTree[path] = sortedEntries;
              fileTree.value = newFileTree;

              console.log(
                `Recovered ${sortedEntries.length} entries for ${path}`,
              );
              return sortedEntries;
            }
          }
        }

        // If no entries were found and retry limit not reached, retry
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(
            `Retrying directory listing (attempt ${retryCount}/${maxRetries})...`,
          );
          continue;
        }

        // If retries exhausted, return empty list as fallback
        console.error("Invalid directory response after retries:", response);
        const newFileTree = { ...fileTree.value };
        newFileTree[path] = [];
        fileTree.value = newFileTree;
        return [];
      }
    } catch (err) {
      retryCount++;

      if (retryCount <= maxRetries) {
        console.warn(
          `Directory listing error, retrying (${retryCount}/${maxRetries}):`,
          err,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      console.error(
        `Failed to list directory ${path} after ${maxRetries} retries:`,
        err,
      );
      // Instead of throwing the error, return an empty array
      const newFileTree = { ...fileTree.value };
      newFileTree[path] = [];
      fileTree.value = newFileTree;
      return [];
    }
  }

  // This should never be reached (loop always returns or throws)
  return [];
}

/**
 * Check if firmware supports smSysex protocol
 * @returns Promise resolving to true if supported
 */
export async function checkFirmwareSupport(): Promise<boolean> {
  if (!midiOut.value) {
    console.error("checkFirmwareSupport: MIDI Output not selected");
    throw new Error("MIDI Output not selected");
  }

  console.log("Checking firmware smSysex support...");
  try {
    // Try to establish a session - this will fail on unsupported firmware
    console.log("Attempting to establish a session...");
    await ensureSession();
    console.log("Session established - firmware supports smSysex");
    return true;
  } catch (err) {
    console.error("Firmware doesn't support smSysex protocol:", err);
    throw new Error("Firmware doesn't support smSysex protocol");
  }
}

// Service keeps an internal promise chain for queue management
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>, _transferId?: string): Promise<T> {
  // silence unused warning
  void _transferId;

  // Reset the cancel flag at the start of a new task
  cancelTransferRequested = false;
  // Clear the tracked files at the start of a new operation
  currentBatchUploadedFiles = [];
  fileTransferInProgress.value = true;

  const promise = queue
    .then(
      () => task(),
      () => task(),
    )
    .finally(() => {
      if (queue === promise) {
        // If no more transfers are active, reset the progress indicators
        if (!anyTransferInProgress.value) {
          fileTransferInProgress.value = false;
          fileTransferProgress.value = null;
        }
      }
    });
  queue = promise;
  return promise;
}

/**
 * Alias for movePath - renames a file or folder
 * @param oldPath Source path
 * @param newPath Destination path
 * @returns Promise resolving when operation completes
 */
export function renamePath(oldPath: string, newPath: string): Promise<void> {
  return movePath(oldPath, newPath);
}

/**
 * Convert FatFS error code to human-readable text
 * @param err FatFS error code
 * @returns Human-readable error message
 */
function fatErrorToText(err: number): string {
  const errors: Record<number, string> = {
    0: "OK",
    1: "Disk error",
    2: "Internal error",
    3: "Drive not ready",
    4: "File not found",
    5: "Path not found",
    6: "Invalid path name",
    7: "Access denied",
    8: "File exists",
    9: "Directory is not empty",
    10: "Invalid object",
    11: "Drive is write-protected",
    12: "Invalid drive",
    13: "No filesystem",
    14: "Format aborted",
    15: "No more files",
    16: "Cannot allocate memory",
    17: "Too many open files",
    18: "Invalid parameter",
  };
  return errors[err] || `Unknown error ${err}`;
}

/**
 * Upload file(s) to the Deluge
 * @param files Array of File objects to upload
 * @param destDir Destination directory
 * @param maxConcurrent Maximum number of concurrent uploads (default: 3)
 * @returns Promise resolving when all uploads complete
 */
export function uploadFiles(
  files: File[],
  destDir: string,
  maxConcurrent: number = 3,
): Promise<void> {
  return enqueue(async () => {
    if (!midiOut.value) throw new Error("MIDI Output not connected");

    // FIXING HOISTING ISSUES: Move all variable declarations to the top
    // Variable tracking
    let filesCompleted = 0;
    let overallBytes = 0;
    let overallTotal = 0;
    const totalFiles = files.length;

    // Track active uploads and their progress - MOVED UP before being referenced
    const activeUploads = new Map<string, { bytes: number; total: number }>();

    // Create arrays for tracking
    const transferItems: TransferItem[] = [];
    const promises: Promise<void>[] = [];

    // Track upload progress in memory to reduce UI updates
    const inMemoryProgress = {
      lastUIUpdateTime: 0,
      updateIntervalMs: 250, // Only update UI every 250ms
      currentPath: "",
      bytes: 0,
      total: 0,
      currentFileIndex: 0,
      totalFiles: 0,
      filesCompleted: 0,
      overallBytes: 0,
      overallTotal: 0,
    };

    // Throttled function to update the progress state (called max once every 120ms)
    const throttledUpdateUI = throttle(() => {
      // Only set the flag if needed
      if (!fileTransferInProgress.value && activeUploads.size > 0) {
        fileTransferInProgress.value = true;
      }

      // Only update signals when we actually have progress to report
      if (inMemoryProgress.currentPath) {
        // Update the progress signal with the latest values
        fileTransferProgress.value = {
          path: inMemoryProgress.currentPath,
          bytes: inMemoryProgress.bytes,
          total: inMemoryProgress.total,
          currentFileIndex: inMemoryProgress.currentFileIndex,
          totalFiles: inMemoryProgress.totalFiles,
          filesCompleted: inMemoryProgress.filesCompleted,
          overallBytes: inMemoryProgress.overallBytes,
          overallTotal: inMemoryProgress.overallTotal,
        };
      }
    }, 120);

    // Update the progress state with combined information from all active uploads
    function updateProgressState() {
      // Use the first active file as the "current" file for display purposes
      const activeEntries = Array.from(activeUploads.entries());
      if (activeEntries.length === 0) {
        fileTransferInProgress.value = false;
        return;
      }

      const [currentPath, currentProgress] = activeEntries[0];

      // Update in-memory tracking first
      inMemoryProgress.currentPath = currentPath;
      inMemoryProgress.bytes = currentProgress.bytes;
      inMemoryProgress.total = currentProgress.total;
      inMemoryProgress.currentFileIndex = filesCompleted;
      inMemoryProgress.totalFiles = totalFiles;
      inMemoryProgress.filesCompleted = filesCompleted;
      inMemoryProgress.overallBytes = overallBytes;
      inMemoryProgress.overallTotal = overallTotal;

      // Use the throttled update function to minimize UI updates
      throttledUpdateUI();
    }

    // Track any pending timeouts so we can clean them up on cancellation
    const pendingTimers: number[] = [];

    // Function to upload a single file
    async function uploadSingleFile(
      file: File,
      index: number,
      transferId: string,
      abortSignal: AbortSignal,
    ): Promise<void> {
      // Also add to active transfers list for backward compatibility
      const newTransfer: FileTransfer = {
        id: transferId,
        path: destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`,
        bytes: 0,
        total: file.size,
        speed: 0,
        type: "upload",
        status: "active",
        startTime: Date.now(),
      };

      activeFileTransfers.value = [...activeFileTransfers.value, newTransfer];

      // Variables for tracking speed
      let lastUpdateTime = Date.now();
      let lastBytes = 0;

      // Cleanup function to clear any resources
      const cleanup = () => {
        // Clear all pending timers
        pendingTimers.forEach(clearTimeout);

        // Clear this file from active uploads
        const filePath =
          destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`;
        activeUploads.delete(filePath);

        // Update UI state
        updateProgressState();
      };

      try {
        // Check if abort was requested before we even start
        if (abortSignal.aborted) {
          throw new Error("Upload cancelled before it started");
        }

        // Register this upload in our tracking map
        const filePath =
          destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`;
        activeUploads.set(filePath, { bytes: 0, total: file.size });
        updateProgressState();

        // Calculate FAT date/time for both file open and metadata
        const now = new Date();
        // FAT-format date (using bit manipulation as per FAT spec)
        const fatDate =
          ((now.getFullYear() - 1980) << 9) |
          ((now.getMonth() + 1) << 5) |
          now.getDate();
        // FAT-format time
        const fatTime =
          (now.getHours() << 11) |
          (now.getMinutes() << 5) |
          Math.floor(now.getSeconds() / 2);

        // 1. Open file with write flag using JSON command
        console.log(`Opening file for writing: ${filePath}`);

        // Open command according to SMSysex spec (JSON format)
        const openCommand = {
          open: {
            path: filePath,
            write: 1, // 1 = create or truncate
            date: fatDate,
            time: fatTime,
          },
        };

        // Check if abort was requested before we open
        if (abortSignal.aborted) {
          throw new Error("Upload cancelled before opening file");
        }

        // Send JSON command via SMSysex
        const response = await sendJson(openCommand);

        // Parse response to get file ID and size
        interface OpenObj {
          fid?: number;
          size?: number;
          err?: number;
        }
        const openObj: OpenObj | undefined =
          (response as { open?: OpenObj })?.open ??
          (response as { "^open"?: OpenObj })["^open"];
        if (!openObj) {
          throw new Error("Invalid open response from device");
        }
        const fileId = openObj.fid ?? index + 1;

        // 2. Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const chunkSize = 512; // Max size per chunk as per spec (actual max is 1024)

        // 3. Send data in chunks
        let bytesSent = 0;

        for (let offset = 0; offset < data.length; offset += chunkSize) {
          // Enhanced cancellation check - check if THIS specific transfer was cancelled
          // global cancel affects all */
          if (
            abortSignal.aborted ||
            filesToCancel.has(transferId) ||
            cancelTransferRequested
          ) {
            console.log(
              `Upload of ${filePath} cancelled - breaking out of chunk loop`,
            );
            // Force immediate cleanup
            activeUploads.delete(filePath);
            updateProgressState();
            throw new Error("Transfer cancelled by user");
          }

          const chunk = data.slice(offset, offset + chunkSize);

          // Prepare write command as JSON
          const writeCommand = {
            write: {
              fid: fileId,
              addr: offset,
              size: chunk.length,
            },
          };

          // Convert JSON to string and then to bytes
          const writeJsonStr = JSON.stringify(writeCommand);
          const writeJsonBytes = Array.from(
            new TextEncoder().encode(writeJsonStr),
          );

          // Encode the binary data in 7-bit format
          const encodedChunk = sharedEncode7Bit(chunk);

          // Write command: JSON header, 0x00 separator, then 7-bit encoded data
          const writeSysex = [
            0xf0,
            0x7d, // Developer ID
            0x04, // Json command
            0x09, // Message ID (should be session-based in real impl)
            ...writeJsonBytes,
            0x00, // Separator between JSON and binary data
            ...encodedChunk,
            0xf7, // End of SysEx
          ];

          // Check midiOut.value again to satisfy TypeScript
          if (!midiOut.value)
            throw new Error("MIDI connection lost during upload");
          midiOut.value.send(writeSysex);

          // Update progress for this file
          bytesSent += chunk.length;

          // Update our tracking maps (in-memory)
          activeUploads.set(filePath, { bytes: bytesSent, total: file.size });

          // Update overall bytes counter
          overallBytes += chunk.length;

          // Update the combined progress display (throttled)
          updateProgressState();

          // Only update transfer list UI at intervals
          const now = Date.now();
          const shouldUpdateUI = now - lastUpdateTime > 250;

          if (shouldUpdateUI) {
            // Update the active transfers list with progress
            const newTransfers = [...activeFileTransfers.value];
            const transferIndex = newTransfers.findIndex(
              (t) => t.id === transferId,
            );

            if (transferIndex !== -1) {
              // Update the progress
              newTransfers[transferIndex].bytes = bytesSent;

              // Calculate speed (bytes per second)
              const timeDiff = now - lastUpdateTime;
              const bytesDiff = bytesSent - lastBytes;
              const bytesPerSecond = bytesDiff / (timeDiff / 1000);

              // Update speed if we have meaningful data
              if (bytesPerSecond > 0) {
                newTransfers[transferIndex].speed = bytesPerSecond;
              }

              // Update the queue UI directly but only periodically
              updateTransferStatus(
                transferId,
                "active",
                undefined,
                file.size,
                bytesSent,
              );

              activeFileTransfers.value = newTransfers;

              // Update tracking variables
              lastUpdateTime = now;
              lastBytes = bytesSent;
            }
          }

          // Wait between chunks to avoid flooding
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // 4. Close file
        const closeCommand = {
          close: {
            fid: fileId,
          },
        };

        await sendJson(closeCommand);

        // 5. Update fileTree with new entry (optimistic)
        const dirPath = destDir || "/";

        // Create a new file entry
        const newEntry: FileEntry = {
          name: file.name,
          size: file.size,
          attr: 0x00, // Regular file
          date: fatDate,
          time: fatTime,
        };

        // Add to destination directory
        const newFileTree = { ...fileTree.value };
        if (!newFileTree[dirPath]) {
          newFileTree[dirPath] = [];
        }

        // Check if file already exists in this directory and replace it instead of adding duplicate
        const existingIndex = newFileTree[dirPath].findIndex(
          (entry) => entry.name === file.name,
        );
        if (existingIndex >= 0) {
          // Replace existing entry
          newFileTree[dirPath][existingIndex] = newEntry;
        } else {
          // Add as new entry
          newFileTree[dirPath] = [...newFileTree[dirPath], newEntry];
        }
        fileTree.value = newFileTree;

        // Mark this file as complete
        filesCompleted++;
        activeUploads.delete(filePath);
        updateProgressState();

        // After successful upload, add to tracked files
        currentBatchUploadedFiles.push(filePath);
        console.log(
          `Added ${filePath} to batch tracking (${currentBatchUploadedFiles.length} files tracked)`,
        );

        // Update the transfer status to completed
        const completedTransfers = [...activeFileTransfers.value];
        const completedIndex = completedTransfers.findIndex(
          (t) => t.id === transferId,
        );

        if (completedIndex !== -1) {
          // Mark as complete but keep in the list
          completedTransfers[completedIndex].status = "active";
          completedTransfers[completedIndex].bytes =
            completedTransfers[completedIndex].total;
          activeFileTransfers.value = completedTransfers;
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Clean up resources on error
        cleanup();

        // Update the transfer status to error
        const errorTransfers = [...activeFileTransfers.value];
        const errorIndex = errorTransfers.findIndex((t) => t.id === transferId);

        if (errorIndex !== -1) {
          errorTransfers[errorIndex].status = "error";
          errorTransfers[errorIndex].error =
            error instanceof Error ? error.message : "Unknown error";
          activeFileTransfers.value = errorTransfers;
        }

        // If this was a cancellation, we want to propagate it
        if (
          filesToCancel.has(transferId) ||
          cancelTransferRequested ||
          (error instanceof Error &&
            error.message === "Transfer cancelled by user")
        ) {
          filesToCancel.delete(transferId); // Clear the cancellation flag
          throw new Error("Transfer cancelled by user");
        }

        throw error;
      } finally {
        // Ensure cleanup happens whether there's an error or success
        cleanup();
      }
    }

    // Check for existing files with the same names
    const dirPath = destDir || "/";
    const existingFiles = fileTree.value[dirPath] || [];

    // Find which files would be overwritten
    const filesWithConflicts: string[] = [];
    for (const file of files) {
      const existingFile = existingFiles.find(
        (entry) => entry.name === file.name,
      );
      if (existingFile) {
        filesWithConflicts.push(file.name);
      }
    }

    // If there are conflicts, show confirmation dialog
    if (filesWithConflicts.length > 0) {
      console.log(`File conflicts detected: ${filesWithConflicts.join(", ")}`);

      // Set the files to override in the confirmation dialog
      filesToOverride.value = filesWithConflicts;

      // Create a promise that will be resolved when the user confirms or cancels
      const userConfirmation = new Promise<boolean>((resolve) => {
        console.log("Setting confirmCallback and showing confirmation dialog");
        confirmCallback.value = resolve;
      });

      // Show the confirmation dialog
      fileOverrideConfirmationOpen.value = true;
      console.log(
        "fileOverrideConfirmationOpen set to:",
        fileOverrideConfirmationOpen.value,
      );

      // Wait for the user's decision
      const confirmed = await userConfirmation;
      console.log("User confirmation result:", confirmed);

      // If user cancelled, abort the upload
      if (!confirmed) {
        console.log("Upload cancelled by user due to file conflicts");
        return;
      }
    }

    // Calculate total size of all files for overall progress
    for (const file of files) {
      overallTotal += file.size;
    }

    // Create TransferItems for each file and add to queue BEFORE awaiting
    // This ensures they appear in the UI immediately
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath =
        destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`;
      const transferId = generateTransferId();

      // Create a transfer item with an abort controller
      const controller = new AbortController();
      const transferItem: TransferItem = {
        id: transferId,
        kind: "upload",
        src: filePath,
        bytes: 0,
        total: file.size,
        status: i < maxConcurrent ? "active" : "pending",
        controller,
      };

      transferItems.push(transferItem);

      // Add upload promise to array - will be executed later
      const uploadPromise = async () => {
        try {
          await uploadSingleFile(file, i, transferId, controller.signal);

          // Update status to completed
          const updatedQueue = [...fileTransferQueue.value];
          const index = updatedQueue.findIndex((t) => t.id === transferId);
          if (index !== -1) {
            updatedQueue[index] = {
              ...updatedQueue[index],
              status: "done",
              bytes: file.size,
            };
            fileTransferQueue.value = updatedQueue;
          }
        } catch (error) {
          // Update status to error
          const updatedQueue = [...fileTransferQueue.value];
          const index = updatedQueue.findIndex((t) => t.id === transferId);
          if (index !== -1) {
            updatedQueue[index] = {
              ...updatedQueue[index],
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed",
            };
            fileTransferQueue.value = updatedQueue;
          }

          throw error;
        }
      };

      promises.push(uploadPromise());
    }

    // Add transfer items to queue
    fileTransferQueue.value = [...fileTransferQueue.value, ...transferItems];

    // Process files in parallel batches using Promise.all
    try {
      const allFiles = [...files];
      while (allFiles.length > 0) {
        // Check global cancellation before starting each batch
        if (cancelTransferRequested) {
          console.log("Transfer cancelled - stopping before next batch");
          throw new Error("Transfer cancelled by user");
        }

        const batch = allFiles.splice(0, maxConcurrent);
        const uploadPromises = batch.map((file, idx) =>
          uploadSingleFile(
            file,
            idx,
            generateTransferId(),
            new AbortController().signal,
          ),
        );

        // Wait for current batch to complete before starting next batch
        await Promise.all(uploadPromises);
      }
    } catch (error) {
      // If this is a cancellation error, we want to treat it specially
      if (
        error instanceof Error &&
        error.message === "Transfer cancelled by user"
      ) {
        console.log("Upload batch processing aborted due to cancellation");
        // Not re-throwing the error as cancellation is not a failure state
        return;
      }
      throw error;
    }
  }, generateTransferId());
}

/**
 * Read a file from the Deluge
 * @param path Path to the file to read
 * @returns Promise resolving with an ArrayBuffer containing the file data
 */
export function readFile(path: string): Promise<ArrayBuffer> {
  console.log(`Reading file: ${path}`);

  // Create a transfer ID and abort controller for this operation
  const transferId = generateTransferId();
  const controller = new AbortController();

  // Add to transfer queue
  const transferItem: TransferItem = {
    id: transferId,
    kind: "download",
    src: path,
    bytes: 0,
    total: 0, // Will be updated once file is opened and size is known
    status: "active",
    controller,
  };

  fileTransferQueue.value = [...fileTransferQueue.value, transferItem];

  return enqueue(async () => {
    await ensureSession();

    try {
      fileTransferInProgress.value = true;
      fileTransferProgress.value = { path, bytes: 0, total: 0 };

      // For backward compatibility - create a FileTransfer entry
      const newTransfer: FileTransfer = {
        id: transferId,
        path,
        bytes: 0,
        total: 0,
        speed: 0,
        type: "download",
        status: "active",
        startTime: Date.now(),
      };
      activeFileTransfers.value = [...activeFileTransfers.value, newTransfer];

      // Track time for speed calculation
      let lastUpdateTime = Date.now();
      let lastBytes = 0;

      // 1. Open file with read flag using JSON command
      console.log(`Opening file for reading: ${path}`);

      // Check if abort was requested
      if (controller.signal.aborted) {
        throw new Error("Download cancelled before starting");
      }

      // Open command according to SMSysex spec (JSON format)
      const openCommand = { open: { path, write: 0 } };

      // Send JSON command via SMSysex
      const response = await sendJson(openCommand);

      interface JsonResponse {
        open?: {
          fid?: number;
          size?: number;
          err?: number;
        };
        "^open"?: {
          // Added '^open' to the interface
          fid?: number;
          size?: number;
          err?: number;
        };
      }
      // Updated the check to look for either 'open' or '^open'
      if (
        !response ||
        !(
          (response as JsonResponse).open || (response as JsonResponse)["^open"]
        )
      ) {
        const error = "Failed to open file: Invalid response";
        console.error(error, response);
        updateTransferStatus(transferId, "error", error);
        throw new Error(error);
      }

      interface OpenObj {
        fid?: number;
        size?: number;
        err?: number;
      }
      const openObj: OpenObj | undefined =
        (response as { open?: OpenObj })?.open ??
        (response as { "^open"?: OpenObj })["^open"];
      if (!openObj) {
        const error = "Failed to open file: Invalid response";
        console.error(error, response);
        updateTransferStatus(transferId, "error", error);
        throw new Error(error);
      }
      const fileId = openObj.fid ?? 1;
      const fileSize = openObj.size ?? 0;

      // Update progress with total size
      console.log(`File opened successfully. Size: ${fileSize} bytes`);
      fileTransferProgress.value = { path, bytes: 0, total: fileSize };

      // Update transfer item with file size
      updateTransferStatus(transferId, "active", undefined, fileSize);

      // Result buffer to accumulate file data
      const result = new Uint8Array(fileSize);
      let bytesRead = 0;

      // 2. Read file in chunks
      const chunkSize = 1024; // Read in 1KB chunks

      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        // Enhanced cancellation check - check if THIS specific transfer was cancelled
        // global cancel affects all
        if (
          controller.signal.aborted ||
          filesToCancel.has(transferId) ||
          cancelTransferRequested
        ) {
          console.log(
            `Download of ${path} cancelled - breaking out of chunk loop`,
          );
          updateTransferStatus(
            transferId,
            "canceled",
            "Download cancelled by user",
          );

          // Only reset global progress if this was the last active transfer
          const anyActiveTransfers = fileTransferQueue.value.some(
            (t) =>
              t.id !== transferId &&
              (t.status === "active" || t.status === "pending"),
          );

          if (!anyActiveTransfers) {
            fileTransferInProgress.value = false;
            fileTransferProgress.value = null;
          }

          throw new Error("Download cancelled by user");
        }

        // Determine size of current chunk (last chunk may be smaller)
        const size = Math.min(chunkSize, fileSize - offset);

        // Read command per SMSysex spec
        const readCommand = {
          read: {
            fid: fileId,
            addr: offset,
            size,
          },
        };

        // Send read command
        console.log(`Reading ${size} bytes at offset ${offset}`);
        const readResponse = await sendJson(readCommand);

        // Check for the data property attached by sendJson
        if (!readResponse || !(readResponse as { data?: Uint8Array }).data) {
          const error = `Failed to read data at offset ${offset}`;
          console.error(error, readResponse);
          updateTransferStatus(transferId, "error", error);
          throw new Error(error);
        }

        // Get the binary data directly
        const bytes = (readResponse as { data: Uint8Array }).data;

        // Copy to result buffer
        result.set(bytes, offset);

        // Update read count
        bytesRead += bytes.length;

        // Update progress
        fileTransferProgress.value = {
          path,
          bytes: bytesRead,
          total: fileSize,
        };

        // Calculate speed
        const now = Date.now();
        const timeDiff = now - lastUpdateTime;
        if (timeDiff > 0) {
          const bytesDiff = bytesRead - lastBytes;
          const bytesPerSecond = bytesDiff / (timeDiff / 1000);
          if (bytesPerSecond > 0) {
            // Update transfer speed in both systems
            updateFileTransferSpeed(transferId, bytesRead, lastBytes, timeDiff);
          }
        }

        // Update tracking variables
        lastBytes = bytesRead;
        lastUpdateTime = now;

        // Update transfer in queue
        updateTransferStatus(
          transferId,
          "active",
          undefined,
          undefined,
          bytesRead,
        );
      }

      // 3. Close file
      console.log("Closing file...");
      const closeCommand = {
        close: {
          fid: fileId,
        },
      };

      // Send close command
      await sendJson(closeCommand);

      console.log("File read complete");
      fileTransferProgress.value = { path, bytes: fileSize, total: fileSize };

      // Update transfer status
      updateTransferStatus(transferId, "done", undefined, fileSize, fileSize);

      // Return result as ArrayBuffer
      return result.buffer;
    } catch (error) {
      console.error("Error reading file:", error);

      // Only update if not already updated (in case of specific error handling)
      const currentItem = fileTransferQueue.value.find(
        (t) => t.id === transferId,
      );
      if (currentItem?.status === "active") {
        updateTransferStatus(
          transferId,
          "error",
          error instanceof Error ? error.message : "Download failed",
        );
      }

      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  }, transferId);
}

// Helper to update a transfer's status and progress
function updateTransferStatus(
  id: string,
  status: TransferItem["status"],
  error?: string,
  total?: number,
  bytes?: number,
) {
  const queue = [...fileTransferQueue.value];
  const index = queue.findIndex((t) => t.id === id);
  if (index !== -1) {
    console.log(
      `Updating transfer ${id}: status=${status}, bytes=${bytes}, total=${total}`,
    );
    queue[index] = {
      ...queue[index],
      status,
      ...(error !== undefined ? { error } : {}),
      ...(total !== undefined ? { total } : {}),
      ...(bytes !== undefined ? { bytes } : {}),
    };
    console.log("Transfer after update:", queue[index]);
    fileTransferQueue.value = queue;
    console.log(
      `Queue now has ${queue.length} items, ${queue.filter((t) => t.status === "active").length} active`,
    );
  }
}

/**
 * Trigger browser download of file data
 * @param buf ArrayBuffer containing file data
 * @param name Filename to use
 */
export function triggerBrowserDownload(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Create a new directory on the Deluge
 * @param dirPath Directory path to create
 * @returns Promise resolving when operation completes
 */
export function createDirectory(dirPath: string): Promise<void> {
  return enqueue(async () => {
    if (!midiOut.value) throw new Error("MIDI Output not connected");

    try {
      fileTransferInProgress.value = true;
      fileTransferProgress.value = { path: dirPath, bytes: 0, total: 1 };

      // Calculate FAT date/time
      const now = new Date();
      // FAT-format date (using bit manipulation as per FAT spec)
      const fatDate =
        ((now.getFullYear() - 1980) << 9) |
        ((now.getMonth() + 1) << 5) |
        now.getDate();
      // FAT-format time
      const fatTime =
        (now.getHours() << 11) |
        (now.getMinutes() << 5) |
        Math.floor(now.getSeconds() / 2);

      // Send mkdir command via SMSysex
      const response = await sendJson({
        mkdir: {
          path: dirPath,
          date: fatDate,
          time: fatTime,
        },
      });

      // Check response
      if (
        response &&
        response["^mkdir"] &&
        typeof response["^mkdir"] === "object" &&
        response["^mkdir"] !== null
      ) {
        const mkdirResponse = response["^mkdir"] as Record<string, unknown>;

        // Check for error
        if (mkdirResponse.err && (mkdirResponse.err as number) !== 0) {
          throw new Error(
            `Failed to create directory: Error ${mkdirResponse.err}`,
          );
        }

        // Update the parent directory's file tree (optimistically)
        const parentDir = dirPath.substring(0, dirPath.lastIndexOf("/")) || "/";
        const dirName = dirPath.substring(dirPath.lastIndexOf("/") + 1);

        // Create a new entry for the directory
        const newEntry: FileEntry = {
          name: dirName,
          size: 0,
          attr: 0x10, // Directory flag
          date: fatDate,
          time: fatTime,
        };

        // Add to parent directory
        const newFileTree = { ...fileTree.value };
        if (!newFileTree[parentDir]) {
          // If parent directory is not cached, refresh it
          await listDirectory(parentDir);
        } else {
          // Add to existing directory and sort
          newFileTree[parentDir] = sortEntriesByDirectoryFirst([
            ...newFileTree[parentDir],
            newEntry,
          ]);
          fileTree.value = newFileTree;
        }
      }

      fileTransferProgress.value = { path: dirPath, bytes: 1, total: 1 };
    } catch (error) {
      console.error("Failed to create directory:", error);
      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  }, generateTransferId());
}

/**

/**
 * Create a new file on the Deluge
 * @param destPath File path to create
 * @param initial Optional initial content (string or ArrayBuffer)
 * @returns Promise resolving when operation completes
 */
export function createFile(
  destPath: string,
  initial?: string | ArrayBuffer,
): Promise<void> {
  return enqueue(async () => {
    if (!midiOut.value) throw new Error("MIDI Output not connected");

    try {
      fileTransferInProgress.value = true;
      fileTransferProgress.value = {
        path: destPath,
        bytes: 0,
        total: initial
          ? initial instanceof ArrayBuffer
            ? initial.byteLength
            : initial.length
          : 0,
      };

      // Calculate FAT date/time
      const now = new Date();
      const fatDate =
        ((now.getFullYear() - 1980) << 9) |
        ((now.getMonth() + 1) << 5) |
        now.getDate();
      const fatTime =
        (now.getHours() << 11) |
        (now.getMinutes() << 5) |
        Math.floor(now.getSeconds() / 2);

      // 1. Open file with write flag
      const openCommand = {
        open: {
          path: destPath,
          write: 1, // 1 = create or truncate
          date: fatDate,
          time: fatTime,
        },
      };

      const response = await sendJson(openCommand);

      // Parse response to get file ID
      if (
        !response ||
        !response["^open"] ||
        typeof response["^open"] !== "object" ||
        response["^open"] === null
      ) {
        throw new Error("Invalid response from open command");
      }

      interface OpenObj {
        fid?: number;
        size?: number;
        err?: number;
      }
      const openObj: OpenObj | undefined =
        (response as { open?: OpenObj })?.open ??
        (response as { "^open"?: OpenObj })["^open"];
      if (!openObj) {
        throw new Error("Invalid open response from device");
      }
      const fileId = openObj.fid ?? 1;

      // 2. Write initial content if provided
      if (initial) {
        let data: Uint8Array;
        if (typeof initial === "string") {
          data = new TextEncoder().encode(initial);
        } else {
          data = new Uint8Array(initial);
        }

        const chunkSize = 1024; // Max size per write block

        for (let offset = 0; offset < data.length; offset += chunkSize) {
          const chunk = data.slice(offset, offset + chunkSize);

          // Write each chunk using uploadFiles helper which handles binary data
          // This is a simplified approach reusing existing functionality
          const tempFile = new File([chunk], "temp.bin", {
            type: "application/octet-stream",
          });

          // We only need the binary transfer capabilities, not actual file upload
          // So we'll bypass the normal upload flow and directly write the block
          await uploadSingleChunk(fileId, offset, tempFile);

          // Update progress
          fileTransferProgress.value = {
            path: destPath,
            bytes: Math.min(offset + chunkSize, data.length),
            total: data.length,
          };
        }
      }

      // 3. Close the file
      const closeCommand = {
        close: {
          fid: fileId,
        },
      };

      await sendJson(closeCommand);

      // 4. Update fileTree with new entry (optimistic)
      const dirPath = destPath.substring(0, destPath.lastIndexOf("/")) || "/";
      const fileName = destPath.substring(destPath.lastIndexOf("/") + 1);

      // Create a new file entry
      const newEntry: FileEntry = {
        name: fileName,
        size: initial
          ? initial instanceof ArrayBuffer
            ? initial.byteLength
            : initial.length
          : 0,
        attr: 0x00, // Regular file
        date: fatDate,
        time: fatTime,
      };

      // Add to destination directory
      const newFileTree = { ...fileTree.value };
      if (!newFileTree[dirPath]) {
        // If parent directory is not cached, refresh it
        await listDirectory(dirPath);
      } else {
        // Add to existing directory and sort
        newFileTree[dirPath] = sortEntriesByDirectoryFirst([
          ...newFileTree[dirPath],
          newEntry,
        ]);
        fileTree.value = newFileTree;
      }

      fileTransferProgress.value = { path: destPath, bytes: 1, total: 1 };
    } catch (error) {
      console.error("Failed to create file:", error);
      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  }, generateTransferId());
}

/**
 * Helper function to upload a single chunk of data with a file ID
 * This is used by createFile to write data chunks
 */
async function uploadSingleChunk(
  fileId: number,
  offset: number,
  file: File,
): Promise<void> {
  if (!midiOut.value) throw new Error("MIDI Output not connected");

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Prepare write command as JSON
  const writeCommand = {
    write: {
      fid: fileId,
      addr: offset,
      size: data.length,
    },
  };

  // Convert JSON to string and then to bytes
  const writeJsonStr = JSON.stringify(writeCommand);
  const writeJsonBytes = Array.from(new TextEncoder().encode(writeJsonStr));

  // Encode the binary data in 7-bit format
  const encodedChunk = sharedEncode7Bit(data);

  // Write command: JSON header, 0x00 separator, then 7-bit encoded data
  const writeSysex = [
    0xf0,
    0x7d, // Developer ID
    0x04, // Json command
    0x09, // Message ID (should be session-based in real impl)
    ...writeJsonBytes,
    0x00, // Separator between JSON and binary data
    ...encodedChunk,
    0xf7, // End of SysEx
  ];

  // Send the command
  midiOut.value.send(writeSysex);

  // Wait for response (this would need to be improved with proper response handling)
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Delete a file or directory on the Deluge
 * @param path Path to delete
 * @returns Promise resolving when operation completes
 */
export function deletePath(path: string): Promise<void> {
  return enqueue(async () => {
    if (!midiOut.value) throw new Error("MIDI Output not connected");

    try {
      fileTransferInProgress.value = true;
      fileTransferProgress.value = { path, bytes: 0, total: 1 };

      // First, prepare for optimistic UI update
      const dirPath = path.substring(0, path.lastIndexOf("/")) || "/";
      const baseName = path.substring(path.lastIndexOf("/") + 1);

      console.log(
        `Deleting ${path} (directory: ${dirPath}, file: ${baseName})`,
      );

      // Send delete command via SMSysex and WAIT for response
      const response = await sendJson({
        delete: {
          path,
        },
      });

      // Check response
      if (
        response &&
        response["^delete"] &&
        typeof response["^delete"] === "object" &&
        response["^delete"] !== null
      ) {
        const deleteResponse = response["^delete"] as Record<string, unknown>;

        // Check for error
        if (deleteResponse.err && (deleteResponse.err as number) !== 0) {
          throw new Error(`Failed to delete: Error ${deleteResponse.err}`);
        }

        console.log(`Delete operation successful, updating file tree`);

        // Clone the fileTree to make updates
        const newFileTree = { ...fileTree.value };

        if (newFileTree[dirPath]) {
          // Find the entry to determine if it's a directory
          const entryToDelete = newFileTree[dirPath]?.find(
            (e) => e.name === baseName,
          );

          if (entryToDelete) {
            const isDir = (entryToDelete.attr & 0x10) !== 0;
            console.log(
              `Found entry to delete: ${baseName}, is directory: ${isDir}`,
            );

            // Remove the entry from the parent directory listing
            newFileTree[dirPath] = newFileTree[dirPath].filter(
              (e) => e.name !== baseName,
            );

            // If it's a directory, also remove all cached subdirectories
            if (isDir) {
              const fullDirPath =
                dirPath === "/" ? `/${baseName}` : `${dirPath}/${baseName}`;
              console.log(
                `Removing directory and all subdirectories under: ${fullDirPath}`,
              );

              // Remove all cached paths that start with this directory path
              Object.keys(newFileTree).forEach((cachePath) => {
                if (
                  cachePath === fullDirPath ||
                  cachePath.startsWith(fullDirPath + "/")
                ) {
                  console.log(`Removing cached path: ${cachePath}`);
                  delete newFileTree[cachePath];
                }
              });

              // Also remove from expanded paths if it was expanded
              if (expandedPaths.value.has(fullDirPath)) {
                const newExpanded = new Set(expandedPaths.value);
                newExpanded.delete(fullDirPath);
                expandedPaths.value = newExpanded;
              }
            }
          } else {
            console.warn(
              `Entry ${baseName} not found in ${dirPath} for deletion`,
            );
          }

          // Update the file tree signal
          fileTree.value = newFileTree;

          // If any paths were selected, update the selection
          if (selectedPaths.value.size > 0) {
            const newSelection = new Set(selectedPaths.value);

            // Remove the deleted path and any of its children from selection
            newSelection.forEach((selPath) => {
              if (selPath === path || selPath.startsWith(path + "/")) {
                newSelection.delete(selPath);
              }
            });

            selectedPaths.value = newSelection;
          }
        }

        // Always refresh the parent directory to ensure tree is in sync with device
        try {
          await listDirectory(dirPath);
        } catch (refreshError) {
          console.error(
            `Failed to refresh directory after delete: ${refreshError}`,
          );
          // Not throwing this error as the delete itself was successful
        }
      } else {
        console.error(`Invalid delete response`, response);
        throw new Error("Invalid response from delete operation");
      }

      fileTransferProgress.value = { path, bytes: 1, total: 1 };
    } catch (error) {
      console.error("Failed to delete path:", error);
      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  }, generateTransferId());
}

/**
 * Cancel a specific file transfer
 * @param transferId ID of the transfer to cancel
 */
export function cancelFileTransfer(transferId: string): void {
  console.log(`Cancelling file transfer: ${transferId}`);

  // Mark this file as needing cancellation, but DON'T set global cancellation flag
  filesToCancel.add(transferId);

  // Find the transfer in our queue
  const queue = [...fileTransferQueue.value];
  const index = queue.findIndex((t) => t.id === transferId);

  if (index !== -1) {
    const transfer = queue[index];

    // Mark it as cancelled in the UI immediately
    queue[index] = {
      ...transfer,
      status: "canceled",
      error: "Cancelled by user",
    };

    fileTransferQueue.value = queue;

    // If the transfer has an AbortController, trigger it
    if (transfer.controller) {
      console.log(`Aborting transfer ${transferId} via AbortController`);
      transfer.controller.abort();
    }

    // Find the file in the active transfers (old system)
    const transfers = [...activeFileTransfers.value];
    const oldIndex = transfers.findIndex((t) => t.id === transferId);

    if (oldIndex !== -1) {
      const oldTransfer = transfers[oldIndex];

      // Mark it as cancelled in the UI immediately
      transfers[oldIndex] = {
        ...oldTransfer,
        status: "error",
        error: "Cancelled by user",
      };

      activeFileTransfers.value = transfers;

      // Delete the partial file if it's an upload
      if (oldTransfer.type === "upload") {
        console.log(`Cleaning up cancelled upload: ${oldTransfer.path}`);

        // We use a setTimeout to let the current operation fully abort
        setTimeout(() => {
          deletePath(oldTransfer.path).catch((err) => {
            console.warn(
              `Failed to delete cancelled upload ${oldTransfer.path}:`,
              err,
            );
          });
        }, 500);
      }
    }

    // Reset state for this specific transfer, but don't impact others
    setTimeout(() => {
      // Check if there are any active transfers left
      const anyActiveTransfers = fileTransferQueue.value.some(
        (t) => t.status === "active" || t.status === "pending",
      );

      // Only clear transfer progress if this was the last active transfer
      if (!anyActiveTransfers) {
        fileTransferInProgress.value = false;
        fileTransferProgress.value = null;
      }
    }, 100);
  }
}

// Helper function to reset the internal promise queue
function resetQueue(): void {
  // Create a new resolved promise to replace the existing queue
  queue = Promise.resolve();
}

/**
 * Cancel all ongoing file transfers
 */
export function cancelAllFileTransfers(): void {
  console.log("Cancelling all file transfers");

  // Mark the global cancel flag
  cancelTransferRequested = true;

  // Flush any pending SysEx message fragments to prevent memory leaks
  flushAllMessages();

  // Abort all controllers
  fileTransferQueue.value.forEach((transfer) => {
    if (
      transfer.controller &&
      (transfer.status === "active" || transfer.status === "pending")
    ) {
      console.log(`Aborting transfer ${transfer.id} via AbortController`);
      transfer.controller.abort();
      filesToCancel.add(transfer.id);
    }
  });

  // Update all transfers to canceled state
  const updatedQueue = fileTransferQueue.value.map((transfer) => {
    if (transfer.status === "active" || transfer.status === "pending") {
      return {
        ...transfer,
        status: "canceled" as TransferItem["status"],
        error: "Cancelled by user",
      };
    }
    return transfer;
  });
  fileTransferQueue.value = updatedQueue;

  // Mark all active transfers as needing cancellation
  const transfers = [...activeFileTransfers.value];
  transfers.forEach((transfer) => {
    if (transfer.status === "active") {
      filesToCancel.add(transfer.id);
    }
  });

  // Update the UI immediately
  const updatedTransfers: FileTransfer[] = transfers.map((transfer) => {
    if (transfer.status === "active") {
      return {
        ...transfer,
        status: "error",
        error: "Cancelled by user",
      } as FileTransfer;
    }
    return transfer;
  });

  activeFileTransfers.value = updatedTransfers;

  // Immediately reset all progress indicators
  fileTransferInProgress.value = false;
  fileTransferProgress.value = null;

  // Clean up the uploads
  setTimeout(() => {
    // Find all uploads to clean up
    const uploadsToClean = transfers.filter(
      (t) => t.type === "upload" && t.status === "active",
    );

    // Delete each file in sequence
    const deleteNextFile = (index: number) => {
      if (index >= uploadsToClean.length) {
        console.log("Cleanup complete");
        return;
      }

      const transfer = uploadsToClean[index];
      console.log(
        `Cleaning up upload ${index + 1}/${uploadsToClean.length}: ${transfer.path}`,
      );

      deletePath(transfer.path)
        .catch((err) => {
          console.warn(`Failed to delete upload ${transfer.path}:`, err);
        })
        .finally(() => {
          // Process next file
          deleteNextFile(index + 1);
        });
    };

    // Start the deletion process if we have files to clean up
    if (uploadsToClean.length > 0) {
      deleteNextFile(0);
    }
  }, 100);

  // Clear all tracking variables
  filesToCancel.clear();
  currentBatchUploadedFiles = [];

  // Force reset of the queue
  resetQueue();
}

/**
 * Remove a completed transfer from the active transfers list
 * @param transferId ID of the transfer to remove
 */
export function removeTransferFromList(transferId: string): void {
  const transfers = activeFileTransfers.value.filter(
    (t) => t.id !== transferId,
  );
  activeFileTransfers.value = transfers;

  // Update fileTransferInProgress if there are no more active transfers
  if (!transfers.some((t) => t.status === "active")) {
    fileTransferInProgress.value = false;
  }
}

/**
 * Move or rename a file/folder on the Deluge
 * @param oldPath Source path
 * @param newPath Destination path
 * @returns Promise resolving when operation completes
 */
export function movePath(oldPath: string, newPath: string): Promise<void> {
  if (oldPath === newPath) return Promise.resolve();

  // Prevent moving a folder into itself or its children
  if (newPath.startsWith(oldPath + "/")) {
    return Promise.reject(new Error("Cannot move a folder into itself"));
  }

  console.log(`Moving/renaming: ${oldPath} → ${newPath}`);

  // Create a transfer ID and abort controller for this operation
  const transferId = generateTransferId();
  const controller = new AbortController();

  // Add to transfer queue
  const transferItem: TransferItem = {
    id: transferId,
    kind: "move",
    src: oldPath,
    dest: newPath,
    bytes: 0,
    total: 1,
    status: "active",
    controller,
  };

  fileTransferQueue.value = [...fileTransferQueue.value, transferItem];

  return enqueue(async () => {
    await ensureSession();

    try {
      fileTransferProgress.value = { path: oldPath, bytes: 0, total: 1 };
      fileTransferInProgress.value = true;

      // Construct the rename command exactly as specified
      const renameCommand = {
        rename: {
          from: oldPath,
          to: newPath,
        },
      };

      console.log("Sending rename command:", JSON.stringify(renameCommand));

      const response = await sendJson(renameCommand);
      console.log("Received rename response:", JSON.stringify(response));

      // Check response for errors
      if (
        response &&
        (response["^rename"] || response["^mkdir"]) &&
        typeof (response["^rename"] || response["^mkdir"]) === "object" &&
        (response["^rename"] || response["^mkdir"]) !== null
      ) {
        const renameResponse = (response["^rename"] ||
          response["^mkdir"]) as Record<string, unknown>;

        // Check for error
        if (renameResponse.err && (renameResponse.err as number) !== 0) {
          const errorCode = renameResponse.err as number;
          const errorMessage = fatErrorToText(errorCode);
          console.error(
            `Rename failed with error ${errorCode}: ${errorMessage}`,
          );

          // Update transfer status to error
          updateTransferStatus(
            transferId,
            "error",
            `Failed to rename: ${errorMessage} (code ${errorCode})`,
          );

          throw new Error(
            `Failed to rename: ${errorMessage} (code ${errorCode})`,
          );
        }

        console.log("Rename operation successful, updating UI state");

        // Update local state (optimistic update)
        const oldDir = oldPath.substring(0, oldPath.lastIndexOf("/") || 0);
        const newDir = newPath.substring(0, newPath.lastIndexOf("/") || 0);
        const baseName = oldPath.substring(oldPath.lastIndexOf("/") + 1);
        const newBaseName = newPath.substring(newPath.lastIndexOf("/") + 1);

        const oldDirPath = oldDir || "/";
        const newDirPath = newDir || "/";

        // Clone the fileTree to make updates
        const newFileTree = { ...fileTree.value };

        if (newFileTree[oldDirPath]) {
          // Find and remove the entry from old location
          const entryIndex = newFileTree[oldDirPath].findIndex(
            (e) => e.name === baseName,
          );
          if (entryIndex !== -1) {
            const [movedEntry] = newFileTree[oldDirPath].splice(entryIndex, 1);

            // Create a new entry for the destination
            const updatedEntry = { ...movedEntry, name: newBaseName };

            // Add to destination directory
            if (!newFileTree[newDirPath]) {
              newFileTree[newDirPath] = [];
            }
            newFileTree[newDirPath].push(updatedEntry);
          }
        }

        // Update the file tree signal
        fileTree.value = newFileTree;

        // Always refresh both parent directories to ensure consistency
        try {
          console.log(`Refreshing source directory: ${oldDirPath}`);
          await listDirectory(oldDirPath);
          if (oldDirPath !== newDirPath) {
            console.log(`Refreshing destination directory: ${newDirPath}`);
            await listDirectory(newDirPath);
          }
        } catch (refreshError) {
          console.error(
            `Failed to refresh directories after rename: ${refreshError}`,
          );
          // Not throwing this error as the rename itself was successful
        }

        fileTransferProgress.value = { path: oldPath, bytes: 1, total: 1 };

        // Update transfer status to done
        updateTransferStatus(transferId, "done");
      } else {
        console.error(`Invalid or missing rename response:`, response);

        // Update transfer status to error
        updateTransferStatus(
          transferId,
          "error",
          "Invalid response from rename operation",
        );

        throw new Error("Invalid response from rename operation");
      }
    } catch (error) {
      console.error("Failed to move/rename path:", error);

      // Only update if not already updated (in case of specific error handling above)
      const currentItem = fileTransferQueue.value.find(
        (t) => t.id === transferId,
      );
      if (currentItem?.status === "active") {
        updateTransferStatus(
          transferId,
          "error",
          error instanceof Error ? error.message : "Move operation failed",
        );
      }

      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  }, transferId);
}
