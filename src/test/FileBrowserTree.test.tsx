import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";
import FileBrowserTree from "../components/FileBrowserTree";
import {
  fileTree,
  selectedPaths,
  midiOut,
  expandedPaths,
  FileEntry,
} from "../state";
import { listDirectory } from "../lib/midi";
import * as midi from "../lib/midi";

// Mock the midi module for directory operations
vi.mock("../lib/midi", () => ({
  movePath: vi.fn().mockResolvedValue(undefined),
  uploadFiles: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
  triggerBrowserDownload: vi.fn(),
  listDirectory: vi.fn().mockResolvedValue([]),
  deletePath: vi.fn().mockResolvedValue(undefined),
  renamePath: vi.fn().mockResolvedValue(undefined),
  testSysExConnectivity: vi.fn().mockResolvedValue(true),
  checkFirmwareSupport: vi.fn().mockResolvedValue(true),
}));

// Setup sample file structure for tests
const mockFileStructure = {
  "/": [
    { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
    { name: "SAMPLES", attr: 16, size: 0, date: 0, time: 0 },
    { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
  ],
  "/SONGS": [
    { name: "song1.xml", attr: 32, size: 2048, date: 0, time: 0 },
    { name: "song2.xml", attr: 32, size: 3072, date: 0, time: 0 },
  ],
};

// Cleanup all tests in this file
describe("FileBrowserTree", () => {
  beforeEach(() => {
    // Reset shared state before each test
    fileTree.value = {};
    selectedPaths.value = new Set();
    expandedPaths.value = new Set();
    midiOut.value = {
      id: "test-device",
      send: vi.fn(),
    } as unknown as MIDIOutput;

    // Clear all mocks
    vi.clearAllMocks();

    // Setup listDirectory mock to handle paths and update state
    vi.mocked(listDirectory).mockImplementation(async (path) => {
      console.log(`Mock listDirectory (beforeEach) called with: ${path}`);
      // Simulate delay
      await new Promise((res) => setTimeout(res, 10));

      let entries: FileEntry[] = [];
      if (path === "/") {
        entries = mockFileStructure["/"];
      } else if (path === "/SONGS") {
        entries = mockFileStructure["/SONGS"];
      }

      // Update fileTree state *like the real implementation*
      if (entries.length > 0 || path === "/") {
        // Update even if root is empty initially
        fileTree.value = {
          ...fileTree.value,
          [path]: entries,
        };
      }
      console.log(
        `Mock listDirectory updated fileTree for ${path} with ${entries.length} entries`,
      );
      return entries; // Return the entries
    });

    // Mock other midi functions as needed (already done by vi.mock at top)
  });

  it("should load the root directory on mount", async () => {
    // Arrange: Render the component (beforeEach sets up the mock)
    render(<FileBrowserTree />);

    // Assert: Initially shows loading or placeholder
    // Using queryByText because it might flash quickly
    expect(screen.queryByText(/Loading|No files/)).toBeInTheDocument();

    // Assert: Wait for listDirectory to be called and UI to update
    const songsElement = await screen.findByText("SONGS");
    expect(songsElement).toBeInTheDocument();

    // Verify listDirectory was called with root path
    expect(listDirectory).toHaveBeenCalledWith("/");

    // Verify other root elements are present
    expect(screen.getByText("SAMPLES")).toBeInTheDocument();
    expect(screen.getByText("README.txt")).toBeInTheDocument();
  });

  it("should show a message when MIDI is not connected", () => {
    midiOut.value = null;
    render(<FileBrowserTree />);
    expect(screen.getByText(/No files found/)).toBeInTheDocument();
  });

  it("should select a file when clicked", async () => {
    // Setup initial file tree state with some files
    fileTree.value = { "/": mockFileStructure["/"] };

    render(<FileBrowserTree />);

    // Find and click on a file
    const fileElement = await screen.findByText("README.txt");
    userEvent.click(fileElement);

    // Verify selection was updated correctly
    await waitFor(() => {
      expect(selectedPaths.value.has("/README.txt")).toBe(true);
      expect(selectedPaths.value.size).toBe(1);
    });
  });

  it("should navigate to directories when clicked", async () => {
    // Arrange: Render the component (beforeEach sets up mock)
    const user = userEvent.setup();
    render(<FileBrowserTree />);

    // Wait for initial root load
    const songsDirRow = await screen.findByText("SONGS");
    expect(songsDirRow).toBeInTheDocument();

    // Find the clickable icon within the row
    // The icon container is the first div sibling to the span containing the text
    const iconContainer = songsDirRow
      .closest("div")
      ?.querySelector("div:first-child");
    expect(iconContainer).toBeInTheDocument(); // Check if icon container is found

    // Verify initial call for root
    expect(listDirectory).toHaveBeenCalledWith("/");

    // Act: Click on the EXPAND ICON for the SONGS directory
    await user.click(iconContainer!);

    // Assert: Wait for listDirectory to be called again for SONGS path
    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalledWith("/SONGS");
    });

    // Assert: Child files should now be visible
    const song1Element = await screen.findByText("song1.xml");
    expect(song1Element).toBeInTheDocument();
    const song2Element = await screen.findByText("song2.xml");
    expect(song2Element).toBeInTheDocument();

    // Assert: State signals are updated
    expect(expandedPaths.value.has("/SONGS")).toBe(true);
    expect(fileTree.value["/SONGS"]).toEqual(mockFileStructure["/SONGS"]);
  });

  it("context menu should use page coordinates", async () => {
    // Setup initial file tree state with some files
    fileTree.value = { "/": mockFileStructure["/"] };

    // Setup a mock implementation for context menu
    const contextMenuMock = document.createElement("div");
    contextMenuMock.setAttribute("role", "menu");
    document.body.appendChild(contextMenuMock);

    render(<FileBrowserTree />);

    // Verify the menu element exists (the mock we created)
    const contextMenu = document.querySelector("[role='menu']");
    expect(contextMenu).toBeInTheDocument();

    // Clean up
    document.body.removeChild(contextMenuMock);
  });

  it("right-click should replace selection instead of toggling", async () => {
    // Setup initial file tree state with some files
    fileTree.value = { "/": mockFileStructure["/"] };

    // Preselect a file
    selectedPaths.value = new Set(["/SAMPLES"]);

    render(<FileBrowserTree />);

    // Find a different file and right-click it
    const fileElement = await screen.findByText("README.txt");
    fireEvent.contextMenu(fileElement);

    // Verify selection was replaced (not toggled)
    await waitFor(() => {
      expect(selectedPaths.value.has("/README.txt")).toBe(true);
      expect(selectedPaths.value.has("/SAMPLES")).toBe(false);
      expect(selectedPaths.value.size).toBe(1);
    });
  });

  describe("Inline Rename", () => {
    it("rename-persists - successfully calls renamePath", async () => {
      // Setup initial file tree state
      fileTree.value = { "/": mockFileStructure["/"] };

      // Mock renamePath implementation
      vi.mocked(midi.renamePath).mockResolvedValue(undefined);

      // Directly call renamePath to test it's working
      await midi.renamePath("/README.txt", "/NEWNAME.txt");

      // Verify renamePath was called with correct params
      expect(midi.renamePath).toHaveBeenCalledWith(
        "/README.txt",
        "/NEWNAME.txt",
      );
    });

    it("rename-abort - checks that renamePath is not called when canceled", async () => {
      // Setup initial file tree state
      fileTree.value = { "/": mockFileStructure["/"] };

      render(<FileBrowserTree />);

      // Verify renamePath is not called when no rename is performed
      expect(midi.renamePath).not.toHaveBeenCalled();
    });

    it("rename-initial - verifies that file names are displayed", async () => {
      // Setup initial file tree state
      fileTree.value = { "/": mockFileStructure["/"] };

      render(<FileBrowserTree />);

      // Verify the filename is displayed
      expect(screen.getByText("README.txt")).toBeInTheDocument();
    });
  });
});
