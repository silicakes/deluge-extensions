/** fullscreen.ts - Full-screen mode and screen wake lock functionality */

import { fullscreenActive } from "../state";

// Detect mobile device
export const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

// Store the wake lock sentinel
let wakeLockSentinel: WakeLockSentinel | null = null;

/**
 * Request fullscreen mode and activate screen wake lock on mobile
 */
export async function request(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    fullscreenActive.value = true;

    // Request wake lock on mobile if supported
    if (isMobile && "wakeLock" in navigator) {
      try {
        wakeLockSentinel = await (navigator as Navigator).wakeLock.request(
          "screen",
        );
      } catch (err) {
        console.error("Failed to request wake lock:", err);
      }
    }
  } catch (err) {
    console.error("Failed to enter fullscreen:", err);
  }
}

/**
 * Exit fullscreen mode and release screen wake lock
 */
export async function exit(): Promise<void> {
  if (!document.fullscreenElement) return;

  try {
    await document.exitFullscreen();
    fullscreenActive.value = false;
  } catch (err) {
    console.error("Failed to exit fullscreen:", err);
  }
}

/**
 * Toggle fullscreen state
 */
export async function toggle(): Promise<void> {
  if (document.fullscreenElement) {
    await exit();
  } else {
    await request();
  }
}

/**
 * Release the wake lock if active
 */
export function releaseWakeLock(): void {
  if (wakeLockSentinel) {
    wakeLockSentinel
      .release()
      .then(() => {
        wakeLockSentinel = null;
      })
      .catch((err) => {
        console.error("Failed to release wake lock:", err);
      });
  }
}

/**
 * Initialize fullscreen change event listeners
 */
export function initFullscreenListeners(): void {
  // Handle fullscreen change or error
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      fullscreenActive.value = false;
      releaseWakeLock();
    }
  });

  // Release wake lock when document visibility changes
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      releaseWakeLock();
    }
  });

  // Release wake lock when page is about to unload
  window.addEventListener("beforeunload", () => {
    releaseWakeLock();
  });
}
