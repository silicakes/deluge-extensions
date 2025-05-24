import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileSpaceWarning, {
  fileSpaceWarningOpen,
  filesWithSpacesNames,
  spaceWarningCallback,
} from "../components/FileSpaceWarning";

describe("FileSpaceWarning", () => {
  it("should not render when closed", () => {
    fileSpaceWarningOpen.value = false;
    render(<FileSpaceWarning />);

    expect(screen.queryByText("Files with Spaces Detected")).toBeNull();
  });

  it("should render when open with file list", () => {
    fileSpaceWarningOpen.value = true;
    filesWithSpacesNames.value = [
      "Test File.xml",
      "Another File With Spaces.txt",
    ];

    render(<FileSpaceWarning />);

    expect(screen.getByText(/Files with Spaces Detected/)).toBeInTheDocument();
    expect(screen.getByText("Test File.xml")).toBeInTheDocument();
    expect(
      screen.getByText("Another File With Spaces.txt"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Known Issue:/)).toBeInTheDocument();
    expect(screen.getByText(/Recommendation:/)).toBeInTheDocument();
  });

  it("should call callback with false when Cancel is clicked", () => {
    const mockCallback = vi.fn();
    fileSpaceWarningOpen.value = true;
    filesWithSpacesNames.value = ["Test.xml"];
    spaceWarningCallback.value = mockCallback;

    render(<FileSpaceWarning />);

    const cancelButton = screen.getByText("Cancel Upload");
    fireEvent.click(cancelButton);

    expect(mockCallback).toHaveBeenCalledWith(false);
    expect(fileSpaceWarningOpen.value).toBe(false);
    expect(filesWithSpacesNames.value).toEqual([]);
    expect(spaceWarningCallback.value).toBeNull();
  });

  it("should call callback with true when Upload Anyway is clicked", () => {
    const mockCallback = vi.fn();
    fileSpaceWarningOpen.value = true;
    filesWithSpacesNames.value = ["Test.xml"];
    spaceWarningCallback.value = mockCallback;

    render(<FileSpaceWarning />);

    const proceedButton = screen.getByText("Upload Anyway");
    fireEvent.click(proceedButton);

    expect(mockCallback).toHaveBeenCalledWith(true);
    expect(fileSpaceWarningOpen.value).toBe(false);
    expect(filesWithSpacesNames.value).toEqual([]);
    expect(spaceWarningCallback.value).toBeNull();
  });
});
