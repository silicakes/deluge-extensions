import { useState, useRef, useEffect, useLayoutEffect } from "preact/hooks";
import { sendCustomSysEx, getDebug } from "@/commands";
import {
  clearDebug,
  useDebugLog,
  setVerboseLogging,
  getVerboseLoggingState,
} from "../lib/debug";
import { fullscreenActive, midiOut } from "../state";
import { sendSysex } from "@/commands/_shared/transport";
import { addDebugMessage } from "@/lib/debug";

// Match the max size in debug.ts
const MAX_DEBUG_LOG_SIZE = 500;

export const SysExConsole = () => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [sysExInput, setSysExInput] = useState("0xF0 0x7d 0x03 0x00 0x01 0xF7");
  const [jsonInput, setJsonInput] = useState<string>('{"ping":{}}');
  const [autoDebug, setAutoDebug] = useState(false);
  const [verboseLogging, setVerboseLoggingState] = useState(
    getVerboseLoggingState(),
  );
  const debugLogRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const debugLog = useDebugLog();

  // Disable controls if no MIDI out
  const disabled = !midiOut.value;

  // Auto debug polling effect
  useEffect(() => {
    let interval: number | null = null;

    if (autoDebug) {
      interval = window.setInterval(() => {
        getDebug();
      }, 1000);
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [autoDebug]);

  // Propagate verbose logging changes
  useEffect(() => {
    setVerboseLogging(verboseLogging);
  }, [verboseLogging]);

  // Scroll to bottom of log when content changes
  useLayoutEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [debugLog.value]);

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

  // Handlers
  const toggleDrawer = () => setIsOpen((prev) => !prev);

  const handleSendCustomSysEx = () => {
    const result = sendCustomSysEx(sysExInput);
    if (result) {
      // The message will be processed and displayed in the debug log
    }
  };

  const handleSendJSON = async () => {
    try {
      const obj = JSON.parse(jsonInput);
      const raw = (await sendSysex({ json: obj })) as { json: unknown };
      addDebugMessage(`JSON Response: ${JSON.stringify(raw.json)}`);
    } catch (e) {
      addDebugMessage(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleToggleAutoDebug = () => {
    setAutoDebug((prev) => !prev);
  };

  const handleToggleVerboseLogging = () => {
    setVerboseLoggingState((prev) => !prev);
  };

  const handleClearDebug = () => {
    clearDebug();
  };

  const handleFetchDebug = () => {
    getDebug();
  };

  // Don't render when in fullscreen mode
  if (fullscreenActive.value) {
    return null;
  }

  return (
    <>
      {/* Settings button */}
      <button
        onClick={toggleDrawer}
        className="cursor-pointer fixed left-4 m-0 bottom-4 z-0 p-2 rounded-full bg-[var(--color-bg-offset)] text-[var(--color-text)] shadow-lg border border-[var(--color-border)]"
        aria-label="Toggle SysEx Console"
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
            d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"
          />
        </svg>
      </button>

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed left-0 bottom-0 w-full bg-[var(--color-bg-offset)] text-[var(--color-text)] shadow-lg border-t border-[var(--color-border)] z-40 transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-full"} h-96 flex flex-col`}
        aria-hidden={!isOpen}
        data-console-open={isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">SysEx Console</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchDebug}
              className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm text-white"
              disabled={disabled}
              aria-label="Fetch debug data once"
            >
              Fetch once
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Close SysEx Console"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Debug Log */}
        <div
          ref={debugLogRef}
          className="flex-1 p-2 overflow-y-auto font-mono text-sm bg-[var(--color-bg)] whitespace-pre-wrap"
        >
          {debugLog.value.map((msg: string, index: number) => (
            <div key={index} className="mb-1">
              {msg}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="p-2 flex items-center gap-2 border-t border-[var(--color-border)] flex-wrap">
          <button
            onClick={handleClearDebug}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm text-white"
            aria-label="Clear debug log"
          >
            Clear
          </button>

          <button
            onClick={handleToggleAutoDebug}
            className={`px-3 py-1 rounded text-sm text-white ${autoDebug ? "bg-green-700 hover:bg-green-600" : "bg-blue-700 hover:bg-blue-600"}`}
            aria-label={autoDebug ? "Stop auto-debug" : "Start auto-debug"}
            disabled={disabled}
          >
            {autoDebug ? "Stop Auto" : "Auto"}
          </button>

          <button
            onClick={handleToggleVerboseLogging}
            className={`px-3 py-1 rounded text-sm text-white ${verboseLogging ? "bg-green-700 hover:bg-green-600" : "bg-blue-700 hover:bg-blue-600"}`}
            aria-label={
              verboseLogging
                ? "Disable verbose logging"
                : "Enable verbose logging"
            }
          >
            {verboseLogging ? "Verbose: ON" : "Verbose: OFF"}
          </button>

          <span className="ml-2 text-xs">
            {autoDebug ? "Auto: ON" : ""} | Log: {debugLog.value.length}/
            {MAX_DEBUG_LOG_SIZE}
          </span>
        </div>

        {/* Custom SysEx Input */}
        <div className="p-2 flex gap-2 border-t border-[var(--color-border)]">
          <input
            type="text"
            value={sysExInput}
            onChange={(e) =>
              setSysExInput((e.target as HTMLInputElement).value)
            }
            className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-sm font-mono"
            placeholder="0xF0 ... 0xF7"
            aria-label="Custom SysEx input"
          />

          <button
            onClick={handleSendCustomSysEx}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white"
            aria-label="Send custom SysEx command"
            disabled={disabled}
          >
            Send
          </button>
        </div>

        {/* Custom JSON Input */}
        <div className="p-2 flex gap-2 border-t border-[var(--color-border)]">
          <input
            type="text"
            value={jsonInput}
            onChange={(e) => setJsonInput((e.target as HTMLInputElement).value)}
            className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-sm font-mono"
            placeholder='{"ping":{}}'
            aria-label="Custom JSON input"
          />

          <button
            onClick={handleSendJSON}
            className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-white"
            aria-label="Send custom JSON command"
            disabled={disabled}
          >
            Send JSON
          </button>
        </div>
      </div>
    </>
  );
};
