import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileBrowserSidebar from "../components/FileBrowserSidebar";
import { fileBrowserOpen, midiOut } from "../state";

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

  it("auto-closes if MIDI output becomes null", () => {
    render(<FileBrowserSidebar />);

    // Initially open
    expect(fileBrowserOpen.value).toBe(true);

    // Simulate MIDI disconnection
    midiOut.value = null;

    // Should auto-close
    expect(fileBrowserOpen.value).toBe(false);
  });
});
