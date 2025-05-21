// Setup for Vitest environment
import { vi } from "vitest";
import "@testing-library/jest-dom"; // Add custom DOM matchers

// Mock navigator.requestMIDIAccess
Object.defineProperty(navigator, "requestMIDIAccess", {
  value: vi.fn().mockImplementation(() =>
    Promise.resolve({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
    }),
  ),
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  value: true,
  writable: true,
});

// Store original method references
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

// Properly mock window methods
window.addEventListener = vi.fn().mockImplementation((event, cb) => {
  // Store any callbacks if we need to trigger them later
  if (event === "online" || event === "offline") {
    // Just store the callback without actually attaching it
    return;
  }

  // For other events, call original implementation
  return originalAddEventListener.call(window, event, cb);
});

window.removeEventListener = vi.fn().mockImplementation((event, cb) => {
  if (event === "online" || event === "offline") {
    // Just pretend to remove the callback
    return;
  }

  // For other events, call original implementation
  return originalRemoveEventListener.call(window, event, cb);
});

// Mock window.alert
window.alert = vi.fn();

// Preact doesn't ship `matchMedia` in JSDOM
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Mock for ResizeObserver, which isn't available in JSDOM
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Make sure crypto.randomUUID is available
if (!crypto.randomUUID) {
  crypto.randomUUID = vi.fn(() =>
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        +c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
      ).toString(16),
    ),
  ) as () => `${string}-${string}-${string}-${string}-${string}`;
}
