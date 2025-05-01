import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileBrowserTree from "../components/FileBrowserTree";
import { fileTree, expandedPaths, midiOut, selectedPath } from "../state";
import { listDirectory } from "../lib/midi";

// Mock the file icons module
vi.mock("../lib/fileIcons", () => ({
  iconForEntry: () => <div data-testid="mock-icon" />,
}));

// Mock the midi.ts module
vi.mock("../lib/midi", () => ({
  listDirectory: vi.fn().mockImplementation((path) => {
    // Mock response based on path
    if (path === "/") {
      return Promise.resolve([
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "SAMPLES", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ]);
    } else if (path === "/SONGS") {
      return Promise.resolve([
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
        { name: "SONG002.XML", attr: 32, size: 5120, date: 0, time: 0 },
      ]);
    } else {
      return Promise.resolve([]);
    }
  }),
}));

describe("FileBrowserTree", () => {
  beforeEach(() => {
    // Reset the signals to their default state
    fileTree.value = {};
    expandedPaths.value = new Set();
    selectedPath.value = null;

    // Mock a connected MIDI device
    midiOut.value = {} as MIDIOutput;

    // Reset mocks
    vi.clearAllMocks();
  });

  it("should show a message when MIDI is not connected", () => {
    midiOut.value = null;
    render(<FileBrowserTree />);
    expect(screen.getByText(/Connect to your Deluge/)).toBeInTheDocument();
  });

  it("should load the root directory on mount", async () => {
    render(<FileBrowserTree />);

    // Initially shows loading
    expect(screen.getByText(/Loading/)).toBeInTheDocument();

    // Verify listDirectory was called with root path
    expect(listDirectory).toHaveBeenCalledWith("/");

    // Mock the fileTree update that would happen via the signal
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "SAMPLES", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    // Now directories should be visible
    expect(screen.getByText("SONGS")).toBeInTheDocument();
    expect(screen.getByText("SAMPLES")).toBeInTheDocument();
    expect(screen.getByText("README.txt")).toBeInTheDocument();
  });

  it("should expand a directory when double-clicked", async () => {
    // Pre-populate the root directory
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    render(<FileBrowserTree />);

    // Double-click on the SONGS directory to expand it
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.dblClick(songsDir);

    // Verify listDirectory was called with the correct path
    expect(listDirectory).toHaveBeenCalledWith("/SONGS");

    // Mock the fileTree update that would happen via the signal
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
      "/SONGS": [
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
        { name: "SONG002.XML", attr: 32, size: 5120, date: 0, time: 0 },
      ],
    };

    // And set the path as expanded
    expandedPaths.value = new Set(["/SONGS"]);

    // Now the expanded files should be visible
    expect(screen.getByText("SONG001.XML")).toBeInTheDocument();
    expect(screen.getByText("SONG002.XML")).toBeInTheDocument();
  });

  it("should collapse a directory when double-clicked again", () => {
    // Pre-populate data and expanded state
    fileTree.value = {
      "/": [{ name: "SONGS", attr: 16, size: 0, date: 0, time: 0 }],
      "/SONGS": [
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
      ],
    };
    expandedPaths.value = new Set(["/SONGS"]);

    render(<FileBrowserTree />);

    // Verify SONG001.XML is visible
    expect(screen.getByText("SONG001.XML")).toBeInTheDocument();

    // Double-click on the SONGS directory to collapse it
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.dblClick(songsDir);

    // Mock the expandedPaths update
    expandedPaths.value = new Set();

    // Now the file should no longer be in the document
    expect(screen.queryByText("SONG001.XML")).not.toBeInTheDocument();
  });

  it("should select an item when clicked", () => {
    // Pre-populate the root directory
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    render(<FileBrowserTree />);

    // Initially nothing is selected
    expect(selectedPath.value).toBeNull();

    // Click on README.txt to select it
    const readmeFile = screen.getByText("README.txt").closest("li")!;
    fireEvent.click(readmeFile);

    // Now it should be selected
    expect(selectedPath.value).toBe("/README.txt");

    // Click on SONGS to select it instead
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.click(songsDir);

    // Now SONGS should be selected
    expect(selectedPath.value).toBe("/SONGS");
  });
});
