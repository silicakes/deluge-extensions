import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileNameIssuesDialog, {
  fileNameIssuesOpen,
  fileValidationResults,
  fileIssuesCallback,
} from "@/components/FileNameIssuesDialog";

describe("FileNameIssuesDialog", () => {
  it("should not render when dialog is closed", () => {
    fileNameIssuesOpen.value = false;
    const { container } = render(<FileNameIssuesDialog />);
    expect(container.innerHTML).toBe("");
  });

  it("should render error dialog when there are invalid filenames", () => {
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "test\tfile.txt"),
        validation: {
          isValid: false,
          sanitized: "test_file.txt",
          errors: ["Illegal characters found: \\x09"],
          warnings: [],
        },
      },
    ];

    render(<FileNameIssuesDialog />);

    expect(screen.getByText("Filename Issues Detected")).toBeInTheDocument();
    expect(screen.getByText(/ERROR:/)).toBeInTheDocument();
    expect(screen.getByText(/Illegal characters found/)).toBeInTheDocument();
    expect(screen.getByText("Use Safe Names & Continue")).toBeInTheDocument();
  });

  it("should render warning dialog when there are only warnings", () => {
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "test.txt. "),
        validation: {
          isValid: true,
          sanitized: "test.txt",
          errors: [],
          warnings: ["Trailing dots or spaces will be removed"],
        },
      },
    ];

    render(<FileNameIssuesDialog />);

    expect(screen.getByText("Filename Issues Detected")).toBeInTheDocument();
    expect(screen.getByText(/WARNING:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Trailing dots or spaces will be removed/),
    ).toBeInTheDocument();
    expect(screen.getByText("Continue Anyway")).toBeInTheDocument();
  });

  it("should show sanitized filename when different from original", () => {
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "CON.txt"),
        validation: {
          isValid: false,
          sanitized: "_CON.txt",
          errors: ["Reserved filename: CON"],
          warnings: [],
        },
      },
    ];

    render(<FileNameIssuesDialog />);

    expect(screen.getByText("CON.txt")).toBeInTheDocument();
    expect(screen.getByText("_CON.txt")).toBeInTheDocument();
    expect(screen.getByText(/Will be saved as:/)).toBeInTheDocument();
  });

  it("should call callback with true and forceSanitize when 'Use Safe Names' is clicked", () => {
    const mockCallback = vi.fn();
    fileIssuesCallback.value = mockCallback;
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "test<file>.txt"),
        validation: {
          isValid: false,
          sanitized: "test_file_.txt",
          errors: ["Illegal characters found: <, >"],
          warnings: [],
        },
      },
    ];

    render(<FileNameIssuesDialog />);

    const button = screen.getByText("Use Safe Names & Continue");
    fireEvent.click(button);

    expect(mockCallback).toHaveBeenCalledWith(true, true);
    expect(fileNameIssuesOpen.value).toBe(false);
    expect(fileValidationResults.value).toEqual([]);
  });

  it("should call callback with false when Cancel is clicked", () => {
    const mockCallback = vi.fn();
    fileIssuesCallback.value = mockCallback;
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "test.txt"),
        validation: {
          isValid: true,
          sanitized: "test.txt",
          errors: [],
          warnings: ["Some warning"],
        },
      },
    ];

    render(<FileNameIssuesDialog />);

    const button = screen.getByText("Cancel Upload");
    fireEvent.click(button);

    expect(mockCallback).toHaveBeenCalledWith(false);
    expect(fileNameIssuesOpen.value).toBe(false);
    expect(fileValidationResults.value).toEqual([]);
  });

  it("should display multiple file issues", () => {
    fileNameIssuesOpen.value = true;
    fileValidationResults.value = [
      {
        file: new File(["test"], "test\nfile.txt"),
        validation: {
          isValid: false,
          sanitized: "test_file.txt",
          errors: ["Illegal characters found: \\x0a"],
          warnings: [],
        },
      },
      {
        file: new File(["test"], "myfile.txt. "),
        validation: {
          isValid: true,
          sanitized: "myfile.txt",
          errors: [],
          warnings: ["Trailing dots or spaces will be removed"],
        },
      },
    ];

    const { container } = render(<FileNameIssuesDialog />);

    // The filename with newline is rendered with the newline preserved in the code block
    const codeElements = container.querySelectorAll("code");
    const fileNames = Array.from(codeElements).map((el) => el.textContent);
    expect(fileNames).toContain("test\nfile.txt");
    expect(fileNames).toContain("myfile.txt. ");
    expect(screen.getByText(/Illegal characters found/)).toBeInTheDocument();
    expect(
      screen.getByText(/Trailing dots or spaces will be removed/),
    ).toBeInTheDocument();
  });
});
