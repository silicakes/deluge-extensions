import { describe, it, expect } from "vitest";
import { render } from "@testing-library/preact";
import { iconForEntry } from "../lib/fileIcons";
import { FileEntry } from "../state";

describe("iconForEntry", () => {
  // Helper function to test icon rendering
  function testIcon(entry: FileEntry, expectedClass: string) {
    const { container } = render(<div>{iconForEntry(entry)}</div>);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass(expectedClass);
  }

  it("returns a folder icon for directories", () => {
    const dirEntry: FileEntry = {
      name: "TestFolder",
      attr: 0x10, // Directory flag
      size: 0,
      date: 0,
      time: 0,
    };

    testIcon(dirEntry, "text-yellow-500");
  });

  it("returns an audio icon for WAV files", () => {
    const wavEntry: FileEntry = {
      name: "sample.wav",
      attr: 0x20,
      size: 1024,
      date: 0,
      time: 0,
    };

    testIcon(wavEntry, "text-blue-500");
  });

  it("returns a MIDI icon for MIDI files", () => {
    const midiEntry: FileEntry = {
      name: "song.mid",
      attr: 0x20,
      size: 512,
      date: 0,
      time: 0,
    };

    testIcon(midiEntry, "text-green-500");
  });

  it("returns a text icon for text files", () => {
    const textEntry: FileEntry = {
      name: "readme.txt",
      attr: 0x20,
      size: 256,
      date: 0,
      time: 0,
    };

    testIcon(textEntry, "text-gray-500");
  });

  it("returns a default icon for unknown file types", () => {
    const unknownEntry: FileEntry = {
      name: "data.bin",
      attr: 0x20,
      size: 1024,
      date: 0,
      time: 0,
    };

    testIcon(unknownEntry, "text-gray-400");
  });
});
