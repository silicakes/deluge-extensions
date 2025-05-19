import { useRef, useState, useEffect, useMemo } from "preact/hooks";
import { useComputed } from "@preact/signals";
import { memo } from "preact/compat";
import {
  fileTransferQueue,
  TransferItem,
  fileTransferProgress,
  fileTransferInProgress,
} from "../state";
import { formatBytes } from "../lib/format";
import {
  cancelFileTransfer,
  cancelAllFileTransfers,
  fsDelete,
} from "@/commands";

// Memoized transfer item component to prevent unnecessary renders
const TransferQueueItem = memo(
  ({
    transfer,
    onCancelClick,
  }: {
    transfer: TransferItem;
    onCancelClick: (id: string) => void;
  }) => {
    // Pre-calculate progress to avoid recalculating in multiple places
    const progress = useMemo(
      () =>
        transfer.total > 0
          ? Math.floor((transfer.bytes / transfer.total) * 100)
          : 0,
      [transfer.bytes, transfer.total],
    );

    // Format display path once during render
    const displayPath = useMemo(() => {
      const filename = transfer.src.split("/").pop() || transfer.src;

      if (transfer.kind === "move" && transfer.dest) {
        const destName = transfer.dest.split("/").pop() || transfer.dest;
        return `${filename} → ${destName}`;
      }

      return filename;
    }, [transfer.src, transfer.dest, transfer.kind]);

    // Get icon based on transfer kind
    const icon = useMemo(() => {
      switch (transfer.kind) {
        case "upload":
          return "⬆️";
        case "download":
          return "⬇️";
        case "move":
          return "↔️";
        default:
          return "📄";
      }
    }, [transfer.kind]);

    // Format sizes only once during render
    const formattedBytes = useMemo(
      () => formatBytes(transfer.bytes, 2),
      [transfer.bytes],
    );
    const formattedTotal = useMemo(
      () => formatBytes(transfer.total, 2),
      [transfer.total],
    );

    // Determine status color class
    const statusColorClass = useMemo(() => {
      if (transfer.status === "error" || transfer.status === "canceled") {
        return "bg-red-500";
      } else if (transfer.status === "done") {
        return "bg-green-500";
      }
      return "bg-blue-600";
    }, [transfer.status]);

    return (
      <div className="flex flex-col rounded-md border border-gray-200 dark:border-gray-700 p-2 text-sm">
        {/* Header: icon, filename, and cancel button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600 dark:text-gray-400">{icon}</span>
            <span className="font-medium truncate max-w-[200px]">
              {displayPath}
            </span>
          </div>

          {/* Cancel button */}
          {(transfer.status === "active" || transfer.status === "pending") && (
            <button
              onClick={() => onCancelClick(transfer.id)}
              aria-label="Cancel transfer"
              className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex justify-between text-xs mt-1.5 text-gray-600 dark:text-gray-400">
          <div className="font-mono tabular-nums ">
            {formattedBytes}/{formattedTotal}
          </div>
          <div>
            {transfer.status === "error" ? (
              <span className="text-red-500">{transfer.error || "Error"}</span>
            ) : transfer.status === "done" ? (
              <span className="text-green-500">Done</span>
            ) : transfer.status === "canceled" ? (
              <span className="text-gray-500">Canceled</span>
            ) : (
              <span>{progress}%</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1">
          <div
            className={`h-1.5 rounded-full transition-[width] ${statusColorClass}`}
            style={{ width: `${progress}%`, transitionDuration: "250ms" }}
          />
        </div>
      </div>
    );
  },
);

/**
 * Component to display a stacked list of file transfers with progress and cancel buttons
 */
const FileTransferQueue = () => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Use computed value to make the component reactive to changes
  const transfers = useComputed(() => fileTransferQueue.value);

  // Memoize handlers to prevent recreating on each render
  const handleCancelClick = useMemo(
    () => (id: string) => {
      setCancelId(id);
      setShowCancelModal(true);
    },
    [],
  );

  // Confirm cancellation (single or all), and delete partial files
  const confirmCancel = useMemo(
    () => async () => {
      if (cancelId === "all") {
        // Capture all paths before aborting
        const paths = transfers.value.map((t) => t.src);
        cancelAllFileTransfers();
        // Delete each cancelled file on device
        await Promise.all(paths.map((path) => fsDelete({ path })));
        // Clear queue and progress UI
        fileTransferQueue.value = [];
        fileTransferProgress.value = null;
        fileTransferInProgress.value = false;
      } else if (cancelId) {
        const transfer = transfers.value.find((t) => t.id === cancelId);
        cancelFileTransfer(cancelId);
        if (transfer) {
          await fsDelete({ path: transfer.src });
        }
      }
      setShowCancelModal(false);
      setCancelId(null);
    },
    [cancelId, transfers.value],
  );

  // Close cancellation modal
  const closeModal = useMemo(
    () => () => {
      setShowCancelModal(false);
      setCancelId(null);
    },
    [],
  );

  // Close modal when clicking outside
  useEffect(() => {
    if (!showCancelModal) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        closeModal();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCancelModal, closeModal]);

  // If the queue is empty, don't render anything
  if (transfers.value.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="transfer-queue"
      className="flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-md p-3 shadow-md transition-all duration-200 max-h-[50vh] overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          File Transfers
        </h3>
        {transfers.value.some(
          (t) => t.status === "active" || t.status === "pending",
        ) ? (
          <button
            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => {
              setCancelId("all");
              setShowCancelModal(true);
            }}
          >
            Cancel All
          </button>
        ) : (
          <button
            className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            onClick={() => {
              fileTransferQueue.value = [];
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Transfer list */}
      <div className="space-y-3">
        {transfers.value.map((transfer) => (
          <TransferQueueItem
            key={transfer.id}
            transfer={transfer}
            onCancelClick={handleCancelClick}
          />
        ))}
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full"
          >
            <h3 className="text-lg font-medium mb-2">
              {cancelId === "all" ? "Cancel All Transfers" : "Cancel Transfer"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to cancel{" "}
              {cancelId === "all" ? "all file transfers" : "this file transfer"}
              ? This operation cannot be undone.
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

export default FileTransferQueue;
