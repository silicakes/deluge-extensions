import { signal } from "@preact/signals";

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

// Helper functions for selection operations
export function selectSingle(path: string): void {
  selectedPaths.value = new Set([path]);
}

export function toggleSelection(path: string): void {
  const newSelection = new Set(selectedPaths.value);
  if (newSelection.has(path)) {
    newSelection.delete(path);
  } else {
    newSelection.add(path);
  }
  selectedPaths.value = newSelection;
}

// File transfer progress tracking signals
export const fileTransferInProgress = signal<boolean>(false);
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
