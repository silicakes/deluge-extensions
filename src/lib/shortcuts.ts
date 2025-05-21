interface ShortcutHelpItem {
  keys: string; // e.g. "S" or "Ctrl+⇧+D"
  description: string; // e.g. "Capture screenshot"
}

interface Shortcut {
  key: string; // `c`, `f`, `?`, `+`, … (lower-case)
  description: string; // Human description (for help overlay)
  modifiers?: {
    ctrl?: boolean;
    meta?: boolean;
    alt?: boolean;
    shift?: boolean; // default = false (pressed or not pressed)
  };
  action?: () => void; // Handler registered at runtime - optional until registered
}

/**
 * Checks if the event target is a typing-focused element where shortcuts should be ignored
 * @param t The event target to check
 * @returns true if shortcuts should be ignored, false otherwise
 */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof Element)) return false;

  // Check for input and textarea elements
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
    return true;
  }

  // Check for contenteditable elements
  if (
    t.hasAttribute("contenteditable") &&
    t.getAttribute("contenteditable") !== "false"
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if the keyboard event's modifiers match the shortcut definition
 * @param e The keyboard event
 * @param def The shortcut modifier definition
 * @returns true if modifiers match, false otherwise
 */
export function modifiersMatch(
  e: KeyboardEvent,
  def?: Shortcut["modifiers"],
): boolean {
  // Check each modifier
  // If a modifier isn't specified in the definition:
  // - It must NOT be pressed in the event
  const ctrlMatch =
    def?.ctrl !== undefined ? e.ctrlKey === def.ctrl : !e.ctrlKey;
  const metaMatch =
    def?.meta !== undefined ? e.metaKey === def.meta : !e.metaKey;
  const altMatch = def?.alt !== undefined ? e.altKey === def.alt : !e.altKey;
  const shiftMatch =
    def?.shift !== undefined ? e.shiftKey === def.shift : !e.shiftKey;

  return ctrlMatch && metaMatch && altMatch && shiftMatch;
}

// Global shortcut definitions that will be populated with actions at runtime
export const shortcuts: Shortcut[] = [
  { key: "s", description: "Capture screenshot" },
  { key: "c", description: "Copy canvas as base64" },
  { key: "f", description: "Toggle fullscreen" },
  { key: "b", description: "Toggle file browser" },
  { key: "+", description: "Increase canvas size", modifiers: { shift: true } },
  { key: "=", description: "Increase canvas size" },
  { key: "-", description: "Decrease canvas size" },
  { key: "d", description: "Toggle display colors" },
  { key: "g", description: "Toggle pixel grid" },
  { key: "?", description: "Toggle help overlay", modifiers: { shift: true } },
  { key: "1", description: "Select 1st Deluge port" },
  { key: "2", description: "Select 2nd Deluge port" },
  { key: "3", description: "Select 3rd Deluge port" },
];

/**
 * Creates a human-readable string representation of shortcuts for the help overlay
 */
export function getShortcutHelpItems(): ShortcutHelpItem[] {
  return shortcuts.map((shortcut) => {
    let keyDisplay = shortcut.key.toUpperCase();

    // For special keys, make them more readable
    if (keyDisplay === "=") keyDisplay = "=";
    if (keyDisplay === "+") keyDisplay = "+";

    // Add modifiers to the display string
    const modifiers = [];
    if (shortcut.modifiers?.ctrl) modifiers.push("Ctrl");
    if (shortcut.modifiers?.meta) modifiers.push("⌘");
    if (shortcut.modifiers?.alt) modifiers.push("Alt");
    if (shortcut.modifiers?.shift) modifiers.push("⇧");

    // Combine modifiers with the key
    const keys =
      modifiers.length > 0
        ? `${modifiers.join("+")}+${keyDisplay}`
        : keyDisplay;

    return {
      keys,
      description: shortcut.description,
    };
  });
}

/**
 * Registers global keyboard shortcuts with the window
 * Should be called once from App.tsx
 */
export function registerGlobalShortcuts(): () => void {
  function handleKeyDown(e: KeyboardEvent) {
    // Skip if target is an input element
    if (isTypingTarget(e.target)) {
      return;
    }

    // Find matching shortcut
    const key = e.key.toLowerCase();
    const shortcut = shortcuts.find(
      (s) => s.key === key && modifiersMatch(e, s.modifiers),
    );

    if (shortcut && shortcut.action) {
      shortcut.action();
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}

// For backward compatibility
export const globalShortcuts: ShortcutHelpItem[] = [
  { keys: "S", description: "Capture screenshot" },
  { keys: "C", description: "Copy canvas as base64" },
  { keys: "F", description: "Toggle fullscreen" },
  { keys: "B", description: "Toggle file browser" },
  { keys: "+ / =", description: "Increase canvas size" },
  { keys: "-", description: "Decrease canvas size" },
  { keys: "D", description: "Toggle display colors" },
  { keys: "G", description: "Toggle pixel grid" },
  { keys: "?", description: "Toggle help overlay" },
  { keys: "1", description: "Select 1st Deluge port" },
  { keys: "2", description: "Select 2nd Deluge port" },
  { keys: "3", description: "Select 3rd Deluge port" },
];
