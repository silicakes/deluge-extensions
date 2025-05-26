import { signal, computed } from "@preact/signals";

export const midiIn = signal<MIDIInput | null>(null);
export const midiOut = signal<MIDIOutput | null>(null);
export const monitorMode = signal(false);
export const debugLog = signal<string[]>([]);
export const theme = signal<"light" | "dark">("light");
export const autoEnabled = signal<boolean>(
  localStorage.getItem("autoConnectEnabled") === "true" ||
    localStorage.getItem("dex-auto-display") !== "false",
);
export const helpOpen = signal(false);
export const fullscreenActive = signal(false);
export const displayType = signal<"OLED" | "7SEG">("OLED");

// Added FileEntry interface for file browser
export interface FileEntry {
  name: string;
  size: number;
  attr: number; // 0x10 bit indicates directory
  date: number; // FAT date format
  time: number; // FAT time format
}

// Maps absolute directory paths to entries returned by the Deluge
export const fileTree = signal<Record<string, FileEntry[]>>({});

// Tracks which directories are currently expanded in UI
export const expandedPaths = signal<Set<string>>(new Set());

// Controls mounting of sidebar & lazy import
export const fileBrowserOpen = signal<boolean>(false);

// Multiple selection support
export const selectedPaths = signal<Set<string>>(new Set());

// Track the path currently being edited (for inline rename)
export const editingPath = signal<string | null>(null);

// File transfer progress tracking signals
export const fileTransferInProgress = signal<boolean>(false);

// Define the type for a single transfer in the queue
export interface TransferItem {
  id: string;
  kind: "upload" | "download" | "move";
  src: string;
  dest?: string;
  bytes: number;
  total: number;
  status: "pending" | "active" | "done" | "error" | "canceled";
  error?: string;
  controller?: AbortController;
}

// Ordered list of queued transfers
export const fileTransferQueue = signal<TransferItem[]>([]);

// Computed helper to check if any transfer is in progress
export const anyTransferInProgress = computed(() =>
  fileTransferQueue.value.some(
    (t) => t.status === "active" || t.status === "pending",
  ),
);

// The original transfer progress signal - kept for backward compatibility
export const fileTransferProgress = signal<{
  path: string;
  bytes: number;
  total: number;
  currentFileIndex?: number;
  totalFiles?: number;
  filesCompleted?: number;
  overallBytes?: number;
  overallTotal?: number;
} | null>(null);

export interface DisplaySettings {
  pixelWidth: number;
  pixelHeight: number;
  foregroundColor: string;
  backgroundColor: string;
  use7SegCustomColors: boolean;
  minSize: number;
  maxSize: number;
  resizeStep: number;
  showPixelGrid: boolean;
}

export const displaySettings = signal<DisplaySettings>({
  pixelWidth: 5,
  pixelHeight: 5,
  foregroundColor: "#eeeeee",
  backgroundColor: "#111111",
  use7SegCustomColors: false,
  minSize: 1,
  maxSize: 32,
  resizeStep: 1,
  showPixelGrid: true,
});

// --- Hydrate display settings from localStorage (runs once at module load) ---
if (typeof window !== "undefined" && "localStorage" in window) {
  try {
    const raw = localStorage.getItem("DExDisplaySettings");
    if (raw) {
      const parsed: Partial<DisplaySettings> = JSON.parse(raw);

      // Determine if we're on a mobile device – duplicate logic from lib/fullscreen
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileEnv = mobileRegex.test(navigator.userAgent);

      // Ignore potentially stale pixel dimensions on mobile to prevent overflow
      if (isMobileEnv) {
        delete (parsed as Partial<DisplaySettings>).pixelWidth;
        delete (parsed as Partial<DisplaySettings>).pixelHeight;
      }

      displaySettings.value = { ...displaySettings.value, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load DExDisplaySettings from localStorage:", err);
  }
}

// Preview functionality
export const previewFile = signal<{
  path: string;
  type: "audio" | "text";
} | null>(null);

// Text editor functionality
export const editingFileState = signal<{
  path: string;
  initialContent: string;
  currentContent: string;
  dirty: boolean;
  error?: string;
} | null>(null);
export const pollingIntervalId = signal<number | null>(null);
export const isSyncEnabled = signal(false);

// Search functionality
export const searchQuery = signal<string>("");
export const searchResults = signal<SearchResult[]>([]);
export const searchMode = signal<boolean>(false);
export const searchFocused = signal<boolean>(false);

export interface SearchResultMatch {
  indices: readonly [number, number][];
  key?: string;
  refIndex?: number;
  value?: string;
}

export interface SearchResult {
  item: {
    path: string;
    entry: FileEntry;
    parentPath: string;
  };
  score: number;
  matches?: SearchResultMatch[];
}
