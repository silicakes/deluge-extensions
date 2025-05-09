/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as webMidi from "../../lib/webMidi";
import { midiIn, midiOut } from "../../state";

describe("webMidi module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    midiIn.value = null;
    midiOut.value = null;
  });

  it("initMidi returns null and logs error when Web MIDI API not supported", async () => {
    // Simulate environment without Web MIDI API
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const stubNav = {
      ...globalThis.navigator,
      requestMIDIAccess: undefined,
    } as unknown as Navigator;
    vi.stubGlobal("navigator", stubNav);
    const result = await webMidi.initMidi();
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Web MIDI API not supported");
    // Restore original navigator
    vi.unstubAllGlobals();
  });

  it("initMidi requests MIDI access with sysex enabled and sets midiAccess", async () => {
    const fakeMidiAccess = { inputs: new Map(), outputs: new Map() } as any;
    const requestSpy = vi.fn().mockResolvedValue(fakeMidiAccess);
    (navigator as any).requestMIDIAccess = requestSpy;
    const result = await webMidi.initMidi(true);
    expect(requestSpy).toHaveBeenCalledWith({ sysex: true });
    expect(result).toBe(fakeMidiAccess);
  });

  it("setMidiInput adds and removes event listeners", () => {
    const mockInput = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
    webMidi.setMidiInput(mockInput);
    expect(midiIn.value).toBe(mockInput);
    expect(mockInput.addEventListener).toHaveBeenCalledWith(
      "midimessage",
      expect.any(Function),
    );
    webMidi.setMidiInput(null);
    expect(mockInput.removeEventListener).toHaveBeenCalledWith(
      "midimessage",
      expect.any(Function),
    );
  });

  it("setMidiOutput updates midiOut signal", () => {
    const mockOutput = {} as any;
    webMidi.setMidiOutput(mockOutput);
    expect(midiOut.value).toBe(mockOutput);
  });

  it("selectDelugeDevice returns false when no midiAccess", () => {
    const result = webMidi.selectDelugeDevice(0);
    expect(result).toBe(false);
  });

  it("selectDelugeDevice selects device when present", async () => {
    const input1 = {
      name: "Deluge Port 3",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
    const output1 = { name: "Deluge Port 3" } as any;
    const fakeMidiAccess = {
      inputs: new Map([["1", input1]]),
      outputs: new Map([["1", output1]]),
    } as any;
    const requestSpy = vi.fn().mockResolvedValue(fakeMidiAccess);
    (navigator as any).requestMIDIAccess = requestSpy;
    await webMidi.initMidi();
    const result = webMidi.selectDelugeDevice(0);
    expect(result).toBe(true);
    expect(midiIn.value).toBe(input1);
    expect(midiOut.value).toBe(output1);
  });

  it("getMidiInputs and getMidiOutputs return arrays", async () => {
    const input1 = { name: "Deluge Port 3" } as any;
    const output1 = { name: "Deluge Port 3" } as any;
    const fakeMidiAccess = {
      inputs: new Map([["1", input1]]),
      outputs: new Map([["1", output1]]),
    } as any;
    const requestSpy = vi.fn().mockResolvedValue(fakeMidiAccess);
    (navigator as any).requestMIDIAccess = requestSpy;
    await webMidi.initMidi();
    expect(webMidi.getMidiInputs()).toEqual([input1]);
    expect(webMidi.getMidiOutputs()).toEqual([output1]);
  });
});
