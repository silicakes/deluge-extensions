export interface ShortcutHelpItem {
  keys: string; // e.g. "S" or "Ctrl+⇧+D"
  description: string; // e.g. "Capture screenshot"
}

export const globalShortcuts: ShortcutHelpItem[] = [
  { keys: "S", description: "Capture screenshot" },
  { keys: "C", description: "Copy canvas as base64" },
  { keys: "F", description: "Toggle fullscreen" },
  { keys: "+ / =", description: "Increase canvas size" },
  { keys: "-", description: "Decrease canvas size" },
  { keys: "D", description: "Toggle display colors" },
  { keys: "G", description: "Toggle pixel grid" },
  { keys: "?", description: "Toggle help overlay" },
];
