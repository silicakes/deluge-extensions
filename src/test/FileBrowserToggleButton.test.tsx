import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileBrowserToggleButton from "../components/FileBrowserToggleButton";
import { fileBrowserOpen, midiOut } from "../state";

describe("FileBrowserToggleButton", () => {
  beforeEach(() => {
    // Reset signal values
    fileBrowserOpen.value = false;
    midiOut.value = {} as MIDIOutput;
  });

  it("renders the button", () => {
    render(<FileBrowserToggleButton />);

    const button = screen.getByLabelText("Open file browser");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("opens the file browser when clicked", () => {
    render(<FileBrowserToggleButton />);

    const button = screen.getByLabelText("Open file browser");
    fireEvent.click(button);

    expect(fileBrowserOpen.value).toBe(true);
  });

  it("is disabled when MIDI output is null", () => {
    midiOut.value = null;
    render(<FileBrowserToggleButton />);

    const button = screen.getByLabelText("Open file browser");
    expect(button).toBeDisabled();
  });
});
