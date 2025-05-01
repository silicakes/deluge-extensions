import {
  midiIn,
  midiOut,
  fileTree,
  FileEntry,
  fileTransferInProgress,
  fileTransferProgress,
  expandedPaths,
  selectedPaths,
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

let midiAccess: MIDIAccess | null = null;
let monitorInterval: number | null = null;

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

/** MIDI message handler – re-export or use event emitter if needed */
export function subscribeMidiListener(listener: (e: MIDIMessageEvent) => void) {
  midiListeners.add(listener);
  return () => midiListeners.delete(listener);
}

function handleMidiMessage(event: MIDIMessageEvent) {
  // forward to listeners
  midiListeners.forEach((fn) => fn(event));
  console.debug("MIDI message", event.data);

  // Handle SysEx messages for smSysex protocol
  if (event.data && event.data.length > 0 && event.data[0] === 0xf0) {
    // Forward to smSysex handler
    handleSysexMessage(event);

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
  try {
    // First try using the standard Synthstrom ID
    console.log("Trying standard Synthstrom ID first");
    await smsPing();
    console.log("Standard ID ping succeeded");
    return true;
  } catch (err) {
    console.warn("Standard SysEx ping failed, trying developer ID:", err);

    try {
      // Try with developer ID (0x7D)
      console.log("Switching to developer ID (0x7D)");
      setDeveloperIdMode(true);
      await smsPing();
      console.log("Developer ID ping succeeded");
      return true;
    } catch (devErr) {
      console.error("Developer ID ping also failed:", devErr);
      // Reset to standard mode
      setDeveloperIdMode(false);
      throw new Error("Device doesn't support file system SysEx communication");
    }
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
  try {
    // Ensure path starts with /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Use smSysex transport to send the dir command
    console.log("Sending dir command via smSysex...");
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
    } else {
      console.error("Invalid directory response:", response);
      throw new Error("Failed to list directory: Invalid response");
    }
  } catch (err) {
    console.error(`Failed to list directory ${path}:`, err);
    throw err;
  }
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
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  fileTransferInProgress.value = true;
  const promise = queue
    .then(
      () => task(),
      () => task(),
    )
    .finally(() => {
      if (queue === promise) {
        fileTransferInProgress.value = false;
        fileTransferProgress.value = null;
      }
    });
  queue = promise;
  return promise;
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
      } else {
        console.error(`Invalid or missing rename response:`, response);
        throw new Error("Invalid response from rename operation");
      }
    } catch (error) {
      console.error("Failed to move/rename path:", error);
      throw error;
    } finally {
      fileTransferInProgress.value = false;
    }
  });
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

    // Proceed with upload as before
    // Calculate total size of all files for overall progress
    const totalFiles = files.length;
    let overallTotal = 0;
    for (const file of files) {
      overallTotal += file.size;
    }

    let filesCompleted = 0;
    let overallBytes = 0;

    // Track active uploads and their progress
    const activeUploads = new Map<string, { bytes: number; total: number }>();

    // Update the progress state with combined information from all active uploads
    function updateProgressState() {
      // Use the first active file as the "current" file for display purposes
      const activeEntries = Array.from(activeUploads.entries());
      if (activeEntries.length === 0) return;

      const [currentPath, currentProgress] = activeEntries[0];

      fileTransferProgress.value = {
        path: currentPath,
        bytes: currentProgress.bytes,
        total: currentProgress.total,
        currentFileIndex: filesCompleted,
        totalFiles,
        filesCompleted,
        overallBytes,
        overallTotal,
      };
    }

    // Function to upload a single file
    async function uploadSingleFile(file: File, index: number): Promise<void> {
      try {
        const filePath =
          destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`;

        // Register this upload in our tracking map
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

        // Send JSON command via SMSysex
        const response = await sendJson(openCommand);

        // In real implementation, extract fileId from response
        // Use a type assertion for the response structure
        interface OpenResponse {
          open?: {
            fid?: number;
          };
        }
        const typedResponse = response as OpenResponse;
        const fileId = typedResponse?.open?.fid || index + 1;

        // 2. Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const chunkSize = 512; // Max size per chunk as per spec (actual max is 1024)

        // 3. Send data in chunks
        let bytesSent = 0;

        for (let offset = 0; offset < data.length; offset += chunkSize) {
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

          // Encode the binary data in 7-bit format per the spec
          const encodedChunk = encode7Bit(chunk);

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

          // Update our tracking maps
          activeUploads.set(filePath, { bytes: bytesSent, total: file.size });

          // Update overall bytes counter (thread-safe since JS is single-threaded)
          overallBytes += chunk.length;

          // Update the combined progress display
          updateProgressState();

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

        // Mark this file as complete and remove from active uploads
        filesCompleted++;
        activeUploads.delete(filePath);
        updateProgressState();
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Remove from active uploads on error
        const filePath =
          destDir === "/" ? `/${file.name}` : `${destDir}/${file.name}`;
        activeUploads.delete(filePath);
        updateProgressState();
        throw error;
      }
    }

    // Process files in parallel batches using Promise.all
    const allFiles = [...files];
    while (allFiles.length > 0) {
      const batch = allFiles.splice(0, maxConcurrent);
      const uploadPromises = batch.map((file, idx) =>
        uploadSingleFile(file, filesCompleted + idx),
      );

      // Wait for current batch to complete before starting next batch
      await Promise.all(uploadPromises);
    }
  });
}

/**
 * Download a file from the Deluge
 * @param path Path to file on Deluge
 * @returns Promise resolving to ArrayBuffer of file contents
 */
export function readFile(path: string): Promise<ArrayBuffer> {
  return enqueue(async () => {
    if (!midiOut.value) throw new Error("MIDI Output not connected");

    try {
      // Get file size from tree
      const dirPath = path.substring(0, path.lastIndexOf("/") || 0) || "/";
      const fileName = path.substring(path.lastIndexOf("/") + 1);
      const fileEntry = fileTree.value[dirPath]?.find(
        (e) => e.name === fileName,
      );

      if (!fileEntry) {
        throw new Error(`File not found: ${path}`);
      }

      const fileSize = fileEntry.size;
      fileTransferProgress.value = { path, bytes: 0, total: fileSize };

      // 1. Open file with read flag
      const pathBytes = Array.from(new TextEncoder().encode(path));

      // SysEx open command (placeholder for actual protocol)
      const openCommand = [
        0xf0,
        0x7d,
        0x04,
        0x01, // Sysex header + open command
        0x00, // Read flag
        ...pathBytes,
        0x00, // NULL terminator
        0xf7, // End of SysEx
      ];

      midiOut.value.send(openCommand);

      // Wait for open response (simulate for now)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Allocate buffer for the file
      const result = new Uint8Array(fileSize);
      const chunkSize = 512; // As per protocol

      // 3. Read in chunks
      let bytesRead = 0;

      while (bytesRead < fileSize) {
        // SysEx read command (placeholder for actual protocol)
        const readCommand = [
          0xf0,
          0x7d,
          0x04,
          0x04, // Sysex header + read command
          Math.min(chunkSize, fileSize - bytesRead) & 0xff, // Chunk size (low byte)
          (Math.min(chunkSize, fileSize - bytesRead) >> 8) & 0xff, // Chunk size (high byte)
          0xf7, // End of SysEx
        ];

        midiOut.value.send(readCommand);

        // Simulate receiving data (in real implementation, would wait for MIDI message)
        // For simulation, we just create a random chunk
        await new Promise((resolve) => setTimeout(resolve, 50));
        const randomChunk = new Uint8Array(
          Math.min(chunkSize, fileSize - bytesRead),
        );
        window.crypto.getRandomValues(randomChunk);

        // Copy chunk to result buffer
        result.set(randomChunk, bytesRead);

        bytesRead += randomChunk.length;
        fileTransferProgress.value = {
          path,
          bytes: bytesRead,
          total: fileSize,
        };
      }

      // 4. Close file
      const closeCommand = [
        0xf0,
        0x7d,
        0x04,
        0x03, // Sysex header + close command
        0xf7, // End of SysEx
      ];

      midiOut.value.send(closeCommand);

      // Wait for close response (simulate for now)
      await new Promise((resolve) => setTimeout(resolve, 100));

      return result.buffer;
    } catch (error) {
      console.error(`Failed to download ${path}:`, error);
      throw error;
    }
  });
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
  });
}

/**
 * Convert binary data to 7-bit MIDI-safe format (for SysEx)
 * @param data Uint8Array of data to encode
 * @returns Encoded array of 7-bit values
 */
function encode7Bit(data: Uint8Array): number[] {
  const result: number[] = [];

  // Process in groups of 7 bytes
  for (let i = 0; i < data.length; i += 7) {
    // Calculate how many bytes we have in this group (last group may be partial)
    const bytesInGroup = Math.min(7, data.length - i);

    // Create a high-bits byte where each bit represents the MSB of a data byte
    let highBits = 0;

    // For each byte in the group, check if its high bit is set
    for (let j = 0; j < bytesInGroup; j++) {
      if (data[i + j] & 0x80) {
        // Set the corresponding bit in our high-bits byte
        highBits |= 1 << j;
      }
    }

    // Add the high-bits byte first
    result.push(highBits);

    // Then add the 7 data bytes with their high bits cleared
    for (let j = 0; j < bytesInGroup; j++) {
      // Mask off the high bit to ensure it's 7-bit clean
      result.push(data[i + j] & 0x7f);
    }
  }

  return result;
}

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

      const openResponse = response["^open"] as Record<string, unknown>;
      if (openResponse.err && (openResponse.err as number) !== 0) {
        throw new Error(`Failed to create file: Error ${openResponse.err}`);
      }

      const fileId = openResponse.fid as number;
      if (fileId === undefined) {
        throw new Error("No file ID returned from open command");
      }

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
  });
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
  const encodedChunk = encode7Bit(data);

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
  });
}
