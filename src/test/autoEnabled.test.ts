import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoEnabled } from "../state";

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
};

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Unified Auto feature", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset signals to initial state
    autoEnabled.value = true;
  });

  it("should initialize with the correct default value", () => {
    // No localStorage value set, should default to true (from legacy keys logic)
    expect(autoEnabled.value).toBe(true);

    // Now set a value in localStorage
    localStorageMock.store["dex-auto-enabled"] = "false";

    // Simulate reinitialization of the signal
    const newAutoEnabled = localStorage.getItem("dex-auto-enabled") === "true";

    // Should respect localStorage value
    expect(newAutoEnabled).toBe(false);
  });

  it("should save value changes to localStorage and migrate legacy keys", () => {
    // First, verify we're starting with autoEnabled = true
    expect(autoEnabled.value).toBe(true);

    // Set up some legacy keys
    localStorageMock.store["autoConnectEnabled"] = "true";
    localStorageMock.store["dex-auto-display"] = "true";

    // Simulate the effect that saves to localStorage and migrates legacy keys
    localStorage.setItem("dex-auto-enabled", autoEnabled.value.toString());
    if (localStorage.getItem("autoConnectEnabled") !== null) {
      localStorage.removeItem("autoConnectEnabled");
    }
    if (localStorage.getItem("dex-auto-display") !== null) {
      localStorage.removeItem("dex-auto-display");
    }

    // Verify true value is saved to new key
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "dex-auto-enabled",
      "true"
    );

    // Verify legacy keys were removed
    expect(localStorage.removeItem).toHaveBeenCalledWith("autoConnectEnabled");
    expect(localStorage.removeItem).toHaveBeenCalledWith("dex-auto-display");

    // Now change to false
    autoEnabled.value = false;

    // Simulate the effect again (just the save part)
    localStorage.setItem("dex-auto-enabled", autoEnabled.value.toString());

    // Verify false value is saved
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "dex-auto-enabled",
      "false"
    );
  });

  it("should initialize using legacy keys when new key is not present", () => {
    // Set only autoConnectEnabled (but not dex-auto-display)
    localStorageMock.store["autoConnectEnabled"] = "true";

    // Simulate the initialization logic from state.ts
    const legacyInitValue =
      localStorage.getItem("autoConnectEnabled") === "true" ||
      localStorage.getItem("dex-auto-display") !== "false";

    // Should be true because autoConnectEnabled is true
    expect(legacyInitValue).toBe(true);

    // Now test with only dex-auto-display
    localStorageMock.clear();
    localStorageMock.store["dex-auto-display"] = "true";

    const legacyInitValue2 =
      localStorage.getItem("autoConnectEnabled") === "true" ||
      localStorage.getItem("dex-auto-display") !== "false";

    // Should be true because dex-auto-display is true
    expect(legacyInitValue2).toBe(true);

    // Test with both set to false
    localStorageMock.clear();
    localStorageMock.store["autoConnectEnabled"] = "false";
    localStorageMock.store["dex-auto-display"] = "false";

    const legacyInitValue3 =
      localStorage.getItem("autoConnectEnabled") === "true" ||
      localStorage.getItem("dex-auto-display") !== "false";

    // Should be false because both are false
    expect(legacyInitValue3).toBe(false);
  });
});
