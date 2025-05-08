import { useState, useRef, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { getOled, startMonitor, stopMonitor } from "../lib/midi";
import { midiOut, monitorMode, autoEnabled } from "../state";
import { Button } from "./Button";
import { startPolling, stopPolling } from "../lib/display";
import { ping } from "@/commands/session";
import { flipScreen, get7Seg } from "@/commands/display";

export function AdvancedDisplayControls() {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Local signal for refresh toggle
  const refreshSignal = useSignal(false);

  // Disable controls if no MIDI out
  const disabled = !midiOut.value;

  // Handlers for display controls
  const handlePing = () => ping();
  const handleOled = () => getOled();
  const handle7Seg = () => get7Seg();

  const toggleRefresh = () => {
    const newValue = !refreshSignal.value;
    refreshSignal.value = newValue;

    // When manually turning off refresh, also turn off auto-enabled
    if (!newValue) {
      autoEnabled.value = false;
    }
  };

  const toggleMonitor = () => {
    monitorMode.value = !monitorMode.value;
  };

  // Effect for refresh polling
  useEffect(() => {
    if (refreshSignal.value) {
      startPolling();
      return () => stopPolling();
    }
  }, [refreshSignal.value]);

  // Effect for monitor mode
  useEffect(() => {
    if (monitorMode.value) {
      startMonitor();
    } else {
      stopMonitor();
    }
  }, [monitorMode.value]);

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen]);

  return (
    <>
      {/* Settings button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer fixed left-4 bottom-12 z-10 p-2 rounded-full bg-[var(--color-bg-offset)] text-[var(--color-text)] shadow-lg border border-[var(--color-border)]"
        aria-label="Advanced Display Controls"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-testid="advanced-controls-toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.992l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 sm:right-0 sm:top-0 sm:bottom-auto w-full sm:w-96 bg-[var(--color-bg-offset)] text-[var(--color-text)] shadow-lg border-t sm:border-l border-[var(--color-border)] z-40 transition-transform duration-200 ${
          isOpen
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="Advanced Display Controls"
        data-testid="advanced-controls-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">Advanced Controls</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label="Close Advanced Controls"
          >
            &times;
          </button>
        </div>

        {/* Controls */}
        <div className="p-3 flex flex-wrap gap-2">
          <Button onClick={handlePing} disabled={disabled}>
            Ping
          </Button>
          <Button onClick={handleOled} disabled={disabled}>
            Get OLED
          </Button>
          <Button onClick={handle7Seg} disabled={disabled}>
            Get 7-Seg
          </Button>
          <Button onClick={flipScreen} disabled={disabled}>
            Flip Screen
          </Button>
          <Button onClick={toggleRefresh} disabled={disabled}>
            {refreshSignal.value ? "Pause" : "Refresh"}
          </Button>
          <Button
            onClick={toggleMonitor}
            disabled={disabled}
            data-testid="monitor-button"
          >
            {monitorMode.value ? "Stop Monitoring" : "Monitor"}
          </Button>
        </div>

        {/* Status */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <div className="flex items-center gap-1">
              <span
                className={`inline-block w-3 h-3 rounded-full ${monitorMode.value ? "bg-green-500" : "bg-gray-400"}`}
              ></span>
              <span data-testid="monitor-status">
                {monitorMode.value ? "MONITOR ON" : "MONITOR OFF"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
