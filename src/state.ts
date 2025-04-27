import { signal } from "@preact/signals";

export const midiIn = signal<MIDIInput | null>(null);
export const midiOut = signal<MIDIOutput | null>(null);
export const monitorMode = signal(false);
export const debugLog = signal<string[]>([]);
export const theme = signal<"light" | "dark">("light");
export const autoDisplay = signal<boolean>(
  localStorage.getItem("dex-auto-display") !== "false"
);
export const helpOpen = signal(false);
export const fullscreenActive = signal(false);

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
