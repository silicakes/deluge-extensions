// Setup for Vitest environment
import { vi, expect } from "vitest";
import "@testing-library/jest-dom"; // Add custom DOM matchers

// Mock navigator.requestMIDIAccess
Object.defineProperty(navigator, "requestMIDIAccess", {
  value: vi.fn().mockImplementation(() =>
    Promise.resolve({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
    })
  ),
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  value: true,
  writable: true,
});
