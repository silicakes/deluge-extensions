import { signal } from "@preact/signals";

// Signal that tracks if a new version is available
export const updateAvailable = signal(false);

// Register the service worker
export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        // Listen for the SW_UPDATED message from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data === "SW_UPDATED") {
            console.log("New version available!");
            updateAvailable.value = true;
          }
        });

        // Check for updates on page load
        if (registration.waiting) {
          updateAvailable.value = true;
        }

        // Also check for updates when SW has a new waiting worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                updateAvailable.value = true;
              }
            });
          }
        });

        console.log("Service Worker registered successfully", registration);
        return registration;
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    });
  }
}

// Function to apply the update (triggered by user via UI)
export function applyUpdate() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        // Send a message to the waiting service worker, instructing it to activate
        registration.waiting.postMessage("SKIP_WAITING");
      }
    });
  }
}

// Initialize service worker registration
registerServiceWorker();
