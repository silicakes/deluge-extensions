import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import { fileTransferProgress } from "../state";
import { formatBytes } from "../lib/format";
import { cancelAllFileTransfers } from "@/commands";
import { throttle } from "../lib/throttle";

// Number of speed history entries to keep
const SPEED_HISTORY_SIZE = 5;

const FileTransferProgress = () => {
  const displayBytes = useSignal("0 Bytes");
  const displayTotal = useSignal("0 Bytes");
  const displayPath = useSignal("");
  const percentage = useSignal(0);
  const currentFileIndex = useSignal(0);
  const totalFiles = useSignal(0);
  const transferSpeed = useSignal("0 KB/s");
  const showCancelConfirmation = useSignal(false);

  // Track speed history for logging
  const speedHistory = useSignal<string[]>([]);
  const rawSpeedHistory = useSignal<number[]>([]);
  const averageSpeed = useSignal("0 KB/s");

  // Reference to the cancel confirmation modal
  const cancelModalRef = useRef<HTMLDivElement>(null);

  // Track previous values for speed calculation
  const lastBytes = useSignal(0);
  const lastUpdateTime = useSignal(Date.now());

  // Throttled update function - only update DOM every 120ms at most
  const throttledUpdateDisplay = throttle(
    (
      bytes: number,
      total: number,
      path: string,
      percent: number,
      fileIdx: number,
      filesTotal: number,
      speed: string,
      bytesPerSecond: number,
    ) => {
      // Only update values that changed to minimize DOM operations
      if (displayBytes.value !== formatBytes(bytes)) {
        displayBytes.value = formatBytes(bytes);
      }

      if (displayTotal.value !== formatBytes(total)) {
        displayTotal.value = formatBytes(total);
      }

      if (displayPath.value !== path) {
        displayPath.value = path;
      }

      if (percentage.value !== percent) {
        percentage.value = percent;
      }

      if (currentFileIndex.value !== fileIdx) {
        currentFileIndex.value = fileIdx;
      }

      if (totalFiles.value !== filesTotal) {
        totalFiles.value = filesTotal;
      }

      if (transferSpeed.value !== speed) {
        transferSpeed.value = speed;

        // Only update speed history for meaningful speeds
        if (bytesPerSecond > 0) {
          // Add to raw speed history
          const newRawHistory = [...rawSpeedHistory.value, bytesPerSecond];
          if (newRawHistory.length > SPEED_HISTORY_SIZE) {
            newRawHistory.shift();
          }
          rawSpeedHistory.value = newRawHistory;

          // Calculate average speed
          const avg =
            newRawHistory.reduce((sum, val) => sum + val, 0) /
            newRawHistory.length;
          averageSpeed.value = `${formatBytes(avg)}/s`;

          // Add to formatted speed history
          const newHistory = [...speedHistory.value, speed];
          if (newHistory.length > SPEED_HISTORY_SIZE) {
            newHistory.shift();
          }
          speedHistory.value = newHistory;
        }
      }
    },
    120,
  );

  // Process progress updates
  useSignalEffect(() => {
    const progress = fileTransferProgress.value;
    if (!progress) return;

    const calculatedPercentage =
      progress.total > 0
        ? Math.floor((progress.bytes / progress.total) * 100)
        : 0;

    // Calculate speed (bytes per second)
    const now = Date.now();
    const timeDiff = (now - lastUpdateTime.value) / 1000; // convert to seconds
    const bytesDiff = progress.bytes - lastBytes.value;

    let speed = transferSpeed.value;
    let bytesPerSecond = 0;
    if (timeDiff > 0) {
      bytesPerSecond = bytesDiff / timeDiff;
      // Only update if we have a meaningful measurement (positive progress)
      if (bytesPerSecond > 0) {
        speed = `${formatBytes(bytesPerSecond)}/s`;
      }
    }

    // Update tracking variables
    lastBytes.value = progress.bytes;
    lastUpdateTime.value = now;

    // Use throttled update to minimize DOM operations
    throttledUpdateDisplay(
      progress.bytes,
      progress.total,
      progress.path,
      calculatedPercentage,
      progress.currentFileIndex || 1,
      progress.totalFiles || 1,
      speed,
      bytesPerSecond,
    );
  });

  // Handler for cancel button click
  const handleCancelClick = (e: MouseEvent) => {
    e.stopPropagation();
    showCancelConfirmation.value = true;
  };

  // Handler for confirming cancel
  const confirmCancel = () => {
    // Cancel the transfer using the MIDI service function
    cancelAllFileTransfers();
    showCancelConfirmation.value = false;
  };

  // Close the modal
  const closeModal = () => {
    showCancelConfirmation.value = false;
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cancelModalRef.current &&
        !cancelModalRef.current.contains(event.target as Node)
      ) {
        closeModal();
      }
    };

    if (showCancelConfirmation.value) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCancelConfirmation.value]);

  // Get the filename from the path
  const fileName = displayPath.value.split("/").pop() || displayPath.value;

  // Create a more descriptive title when uploading multiple files
  const titleText =
    totalFiles.value > 1
      ? `Uploading ${totalFiles.value} files (${currentFileIndex.value}/${totalFiles.value})`
      : fileName;

  return (
    <div className="w-full" data-testid="transfer-queue">
      {/* Header with file info and cancel button */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate pr-2">
          {totalFiles.value > 1 ? (
            <div className="flex flex-col">
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {titleText}
              </span>
              <span className="text-xs opacity-80 truncate">
                Current: {fileName}
              </span>
            </div>
          ) : (
            fileName
          )}
        </div>
        <button
          className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors p-0.5 rounded-full"
          onClick={handleCancelClick}
          aria-label="Cancel transfer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Progress info in a more compact layout */}
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center space-x-1">
          <span className="text-xs font-mono tabular-nums">
            {displayBytes.value}
          </span>
          <span>/</span>
          <span className="text-xs font-mono tabular-nums">
            {displayTotal.value}
          </span>
          <span className="ml-1">({percentage.value}%)</span>
        </div>
        <div className="font-mono text-xs text-blue-600 dark:text-blue-400 tabular-nums">
          {transferSpeed.value}
        </div>
      </div>

      {/* Speed history log */}
      {speedHistory.value.length > 0 && (
        <div className="flex items-center text-xs mb-1.5 text-gray-500 dark:text-gray-400">
          <span className="mr-1">Speed log:</span>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
              {speedHistory.value.map((speed, i) => (
                <span
                  key={i}
                  className="font-mono whitespace-nowrap"
                  style={{
                    opacity:
                      0.5 + 0.5 * (i / (speedHistory.value.length - 1 || 1)),
                  }}
                >
                  {speed}
                </span>
              ))}
            </div>
          </div>
          <span className="ml-2 font-medium whitespace-nowrap">
            Avg: {averageSpeed.value}
          </span>
        </div>
      )}

      {/* Progress bar - optimize transition by only applying it when percentage changes */}
      <div
        data-testid="transfer-progress-bar"
        className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full"
      >
        <div
          className="bg-blue-600 h-1.5 rounded-full"
          style={{
            width: `${percentage.value}%`,
            transition: "width 200ms ease-in-out",
          }}
        />
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmation.value && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div
            ref={cancelModalRef}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full"
          >
            <h3 className="text-lg font-medium mb-2">Cancel Transfer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {totalFiles.value > 1
                ? `Are you sure you want to cancel transferring all ${totalFiles.value} files?`
                : "Are you sure you want to cancel the current file transfer?"}
              This operation cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded"
                onClick={closeModal}
              >
                No, Continue
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded"
                onClick={confirmCancel}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileTransferProgress;
