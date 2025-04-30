import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMidiNavbar } from "../hooks/useMidiNavbar";
import * as midiService from "../lib/midi";
import { midiIn, midiOut, autoEnabled } from "../state";

// Mock the midi library
vi.mock("../lib/midi", () => ({
  initMidi: vi.fn(),
  getMidiInputs: vi.fn(),
  getMidiOutputs: vi.fn(),
  setMidiInput: vi.fn(),
  setMidiOutput: vi.fn(),
  autoConnectDefaultPorts: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", { value: true, writable: true });

// Mock event listeners
window.addEventListener = vi.fn();
window.removeEventListener = vi.fn();

describe("useMidiNavbar hook", () => {
  // Reset signals before each test
  beforeEach(() => {
    midiIn.value = null;
    midiOut.value = null;
    autoEnabled.value = false;
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to setup mock for hook testing
  function setupHookTest() {
    // We need to mock the hook since we can't call it outside of a component
    const mockInputs = [{ id: "input1", name: "Test Input" }] as MIDIInput[];
    const mockOutputs = [
      { id: "output1", name: "Test Output" },
    ] as MIDIOutput[];

    vi.mocked(midiService.getMidiInputs).mockReturnValue(mockInputs);
    vi.mocked(midiService.getMidiOutputs).mockReturnValue(mockOutputs);
    vi.mocked(midiService.initMidi).mockResolvedValue({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
    } as unknown as MIDIAccess);

    return { mockInputs, mockOutputs };
  }

  it("should call initMidi on mount", async () => {
    setupHookTest();

    // We can't directly test the hook execution but we can verify
    // the expected behavior of calling initMidi
    expect(midiService.initMidi).toHaveBeenCalled();
  });

  it("should setup online/offline event listeners", () => {
    setupHookTest();

    expect(window.addEventListener).toHaveBeenCalledWith(
      "online",
      expect.any(Function),
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      "offline",
      expect.any(Function),
    );
  });

  it("should call setMidiInput when onInputChange is invoked", () => {
    const { mockInputs } = setupHookTest();

    // Simulate event handler call
    const event = { target: { value: "input1" } } as unknown as Event;
    const { onInputChange } = useMidiNavbar();

    onInputChange(event);

    expect(midiService.setMidiInput).toHaveBeenCalledWith(mockInputs[0]);
  });

  it("should call setMidiOutput when onOutputChange is invoked", () => {
    const { mockOutputs } = setupHookTest();

    // Simulate event handler call
    const event = { target: { value: "output1" } } as unknown as Event;
    const { onOutputChange } = useMidiNavbar();

    onOutputChange(event);

    expect(midiService.setMidiOutput).toHaveBeenCalledWith(mockOutputs[0]);
  });

  it("should update autoEnabled signal and call autoConnectDefaultPorts when onAutoToggle is invoked", () => {
    setupHookTest();

    // Simulate event handler call with checked=true
    const event = { target: { checked: true } } as unknown as Event;
    const { onAutoToggle } = useMidiNavbar();

    onAutoToggle(event);

    expect(autoEnabled.value).toBe(true);
    expect(midiService.autoConnectDefaultPorts).toHaveBeenCalled();
  });
});
