import { render, fireEvent } from "@testing-library/preact";
import { DisplayColorDrawer } from "../components/DisplayColorDrawer";
import { displaySettings } from "../state";
import { themePreference, setTheme } from "../lib/theme";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock theme module
vi.mock("../lib/theme", () => ({
  themePreference: {
    value: "light",
  },
  setTheme: vi.fn(),
  ThemeType: {}, // Mock for TypeScript type
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("DisplayColorDrawer", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset display settings before each test
    displaySettings.value = {
      pixelWidth: 5,
      pixelHeight: 5,
      foregroundColor: "#eeeeee",
      backgroundColor: "#111111",
      use7SegCustomColors: false,
      minSize: 1,
      maxSize: 32,
      resizeStep: 1,
      showPixelGrid: true,
    };

    // Reset theme preference
    (themePreference as { value: string }).value = "light";
  });

  afterEach(() => {
    // Clean up any remaining event listeners
    document.body.innerHTML = "";
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <DisplayColorDrawer isOpen={false} onClose={mockOnClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the drawer when isOpen is true", () => {
    const { getByLabelText, getByText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    expect(getByText("Appearance Settings")).toBeTruthy();
    expect(getByLabelText("Close drawer")).toBeTruthy();
  });

  it("renders theme controls when includeThemeControls is true", () => {
    const { getByText } = render(
      <DisplayColorDrawer
        isOpen={true}
        onClose={mockOnClose}
        includeThemeControls={true}
      />,
    );

    expect(getByText("Theme")).toBeTruthy();
    expect(getByText("Light")).toBeTruthy();
    expect(getByText("Dark")).toBeTruthy();
    expect(getByText("System")).toBeTruthy();
  });

  it("doesn't render theme controls when includeThemeControls is false", () => {
    const { queryByText } = render(
      <DisplayColorDrawer
        isOpen={true}
        onClose={mockOnClose}
        includeThemeControls={false}
      />,
    );

    expect(queryByText("Theme")).toBeNull();
  });

  it("displays the current color values", () => {
    displaySettings.value = {
      ...displaySettings.value,
      foregroundColor: "#ffffff",
      backgroundColor: "#000000",
    };

    const { getAllByDisplayValue } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    const colorInputs = getAllByDisplayValue("#ffffff");
    expect(colorInputs.length).toBeGreaterThan(0);

    const bgColorInputs = getAllByDisplayValue("#000000");
    expect(bgColorInputs.length).toBeGreaterThan(0);
  });

  it("updates foreground color when changed", () => {
    const { getAllByLabelText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    const colorInput = getAllByLabelText(
      "Foreground color",
    )[0] as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: "#ff0000" } });

    expect(displaySettings.value.foregroundColor).toBe("#ff0000");
  });

  it("updates background color when changed", () => {
    const { getAllByLabelText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    const colorInput = getAllByLabelText(
      "Background color",
    )[0] as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: "#0000ff" } });

    expect(displaySettings.value.backgroundColor).toBe("#0000ff");
  });

  it("updates custom 7-segment setting when toggled", () => {
    const { getByText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    const checkbox = getByText("Use custom for 7-segment")
      .previousSibling as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(displaySettings.value.use7SegCustomColors).toBe(true);
  });

  it("updates pixel grid setting when toggled", () => {
    const { getByText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    // Initially, showPixelGrid should be true (from beforeEach)
    expect(displaySettings.value.showPixelGrid).toBe(true);

    const checkbox = getByText("Pixel grid")
      .previousSibling as HTMLInputElement;
    fireEvent.click(checkbox);

    // After clicking, it should be false
    expect(displaySettings.value.showPixelGrid).toBe(false);
  });

  it("calls setTheme when a theme option is selected", () => {
    const { getByLabelText } = render(
      <DisplayColorDrawer
        isOpen={true}
        onClose={mockOnClose}
        includeThemeControls={true}
      />,
    );

    // Find and click the Dark theme radio button
    const darkRadio = getByLabelText("Dark") as HTMLInputElement;
    fireEvent.click(darkRadio);

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("calls onClose when close button is clicked", () => {
    const { getByLabelText } = render(
      <DisplayColorDrawer isOpen={true} onClose={mockOnClose} />,
    );

    fireEvent.click(getByLabelText("Close drawer"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside the drawer", () => {
    // This test now needs to be updated since we're no longer using a full overlay
    document.addEventListener = vi.fn((event, handler) => {
      if (event === "mousedown") {
        // Manually trigger the handler with a fake event that's outside the drawer
        (handler as EventListener)({
          target: document.createElement("div"), // Some element that's not in the drawer
        } as unknown as Event);
      }
    });

    render(<DisplayColorDrawer isOpen={true} onClose={mockOnClose} />);

    // The drawer should try to close
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when pressing Escape key", () => {
    document.addEventListener = vi.fn((event, handler) => {
      if (event === "keydown") {
        // Manually trigger the handler with a fake Escape key event
        (handler as EventListener)({
          key: "Escape",
        } as unknown as Event);
      }
    });

    render(<DisplayColorDrawer isOpen={true} onClose={mockOnClose} />);

    // The drawer should try to close
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
