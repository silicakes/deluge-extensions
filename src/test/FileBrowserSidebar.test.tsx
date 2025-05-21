import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import FileBrowserSidebar from "../components/FileBrowserSidebar";
import { fileBrowserOpen, midiOut, selectedPaths } from "../state";
import * as commands from "@/commands";

// Mock the lazy-loaded FileBrowserTree component
vi.mock("preact/compat", async () => {
  const actual = await vi.importActual("preact/compat");
  return {
    ...(actual as object),
    lazy: () => () => (
      <div data-testid="mock-file-browser-tree">FileBrowserTree mock</div>
    ),
  };
});

describe("FileBrowserSidebar", () => {
  beforeEach(() => {
    // Reset signal values
    fileBrowserOpen.value = true;
    midiOut.value = {} as MIDIOutput;
    selectedPaths.value = new Set();
  });

  it("renders the sidebar with a header and tree", () => {
    render(<FileBrowserSidebar />);

    expect(screen.getByText("SD Card")).toBeInTheDocument();
    expect(screen.getByTestId("mock-file-browser-tree")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    render(<FileBrowserSidebar />);

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);

    expect(fileBrowserOpen.value).toBe(false);
  });

  it("auto-closes if MIDI output becomes null", async () => {
    render(<FileBrowserSidebar />);

    // Initially open
    expect(fileBrowserOpen.value).toBe(true);

    // Simulate MIDI disconnection
    midiOut.value = null;

    // Wait for signal propagation and component update
    await waitFor(
      () => {
        expect(fileBrowserOpen.value).toBe(false);
      },
      { timeout: 1000 },
    );
  });

  it("refresh button always calls listDirectory for the root path", async () => {
    // Mock the listDirectory command
    const listDirectoryMock = vi
      .spyOn(commands, "listDirectory")
      .mockResolvedValue([]);

    // Simulate a selected path that is not root
    selectedPaths.value = new Set(["/SONGS"]);

    render(<FileBrowserSidebar />);

    const refreshButton = screen.getByLabelText("Refresh directory");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(listDirectoryMock).toHaveBeenCalledWith({
        path: "/",
        force: true,
      });
    });

    // Reset selectedPaths for other tests if necessary, though beforeEach should handle it.
    selectedPaths.value = new Set();
  });
});
