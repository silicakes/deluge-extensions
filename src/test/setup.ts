// Setup for Vitest environment
import { vi } from 'vitest';

// Mock navigator.requestMIDIAccess
Object.defineProperty(navigator, 'requestMIDIAccess', {
  value: vi.fn().mockImplementation(() => Promise.resolve({
    inputs: new Map(),
    outputs: new Map(),
    onstatechange: null,
  })),
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
}); 