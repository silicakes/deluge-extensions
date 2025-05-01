import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateAvailable, applyUpdate, registerServiceWorker } from "./pwa";

// Mock the navigator.serviceWorker
const mockServiceWorker = {
  register: vi.fn().mockResolvedValue({
    waiting: null,
    addEventListener: vi.fn(),
  }),
  addEventListener: vi.fn(),
  ready: Promise.resolve({
    waiting: {
      postMessage: vi.fn(),
    },
  }),
  controller: {},
};

describe("PWA module", () => {
  beforeEach(() => {
    // Reset the signal value
    updateAvailable.value = false;

    // Save original navigator
    vi.stubGlobal("navigator", {
      serviceWorker: mockServiceWorker,
    });

    // Mock window.addEventListener
    vi.stubGlobal("window", {
      ...window,
      addEventListener: vi.fn((event, cb) => {
        if (event === "load") {
          cb();
        }
      }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("registers the service worker on load", async () => {
    registerServiceWorker();
    expect(mockServiceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("detects update when service worker has waiting worker", async () => {
    mockServiceWorker.register.mockResolvedValueOnce({
      waiting: {},
      addEventListener: vi.fn(),
    });

    registerServiceWorker();

    // Wait for promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateAvailable.value).toBe(true);
  });

  it("sends SKIP_WAITING message when applying update", async () => {
    const postMessageSpy = vi.fn();
    const mockRegistration = {
      waiting: {
        postMessage: postMessageSpy,
      },
    };

    mockServiceWorker.ready = Promise.resolve(mockRegistration);

    await applyUpdate();

    expect(postMessageSpy).toHaveBeenCalledWith("SKIP_WAITING");
  });
});
