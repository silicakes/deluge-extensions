import { useState, useRef } from "preact/hooks";
import { activeFileTransfers } from "../state";
import { formatBytes } from "../lib/format";
import {
  cancelFileTransfer,
  cancelAllFileTransfers,
  removeTransferFromList,
} from "@/commands";

/**
 * A component that displays a list of all active file transfers with individual cancel buttons
 */
const FileTransfersList = () => {
  const transfers = activeFileTransfers.value;
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if we have any active transfers
  const hasActiveTransfers = transfers.some((t) => t.status === "active");

  // Handle cancel click
  const handleCancelClick = (transferId: string) => {
    setCancelTargetId(transferId);
    setShowCancelConfirmation(true);
  };

  // Confirm cancel
  const confirmCancel = () => {
    if (cancelTargetId === "all") {
      cancelAllFileTransfers();
    } else if (cancelTargetId) {
      cancelFileTransfer(cancelTargetId);
    }
    setShowCancelConfirmation(false);
    setCancelTargetId(null);
  };

  // Close modal
  const closeModal = () => {
    setShowCancelConfirmation(false);
    setCancelTargetId(null);
  };

  // Handle remove button click
  const handleRemoveClick = (transferId: string) => {
    removeTransferFromList(transferId);
  };

  // Handle cancel all button click
  const handleCancelAllClick = () => {
    setCancelTargetId("all");
    setShowCancelConfirmation(true);
  };

  // If no transfers, don't render anything
  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">File Transfers</h3>
        {hasActiveTransfers && (
          <button
            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={handleCancelAllClick}
          >
            Cancel All
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {transfers.map((transfer) => {
          // Get the filename from the path
          const fileName = transfer.path.split("/").pop() || transfer.path;
          // Calculate progress percentage
          const progress =
            transfer.total > 0
              ? Math.floor((transfer.bytes / transfer.total) * 100)
              : 0;

          // Debug log to see if speed is available
          console.log(
            `Transfer ${fileName}: speed=${transfer.speed}, status=${transfer.status}`,
          );

          // Create a dedicated speed display that's always visible during active transfers
          const speedDisplay =
            transfer.status === "active"
              ? `${formatBytes(transfer.speed || 0)}/s`
              : progress === 100
                ? "Complete"
                : `${progress}%`;

          return (
            <div
              key={transfer.id}
              className={`p-2 border rounded-md ${
                transfer.status === "active"
                  ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                  : transfer.status === "error"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                    : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-medium truncate max-w-[80%]">
                  {fileName}
                  <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({transfer.type})
                  </span>
                </div>

                {transfer.status === "active" ? (
                  <button
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={() => handleCancelClick(transfer.id)}
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
                ) : (
                  <button
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    onClick={() => handleRemoveClick(transfer.id)}
                    aria-label="Remove from list"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Error message if applicable */}
              {transfer.status === "error" && transfer.error && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {transfer.error}
                </div>
              )}

              {/* Progress info */}
              <div className="flex justify-between items-center text-xs mt-1.5 text-gray-600 dark:text-gray-400">
                <div>
                  {formatBytes(transfer.bytes)} of {formatBytes(transfer.total)}
                </div>

                {/* Speed indicator - always show for active transfers */}
                {transfer.status === "active" && (
                  <div className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-100 font-medium ml-2">
                    {speedDisplay}
                  </div>
                )}

                {transfer.status !== "active" && (
                  <div className="font-mono">{speedDisplay}</div>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1 rounded-full mt-1">
                <div
                  className={`h-1 rounded-full transition-all ${
                    transfer.status === "error"
                      ? "bg-red-500"
                      : progress === 100
                        ? "bg-green-500"
                        : "bg-blue-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full"
          >
            <h3 className="text-lg font-medium mb-2">Cancel Transfer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {cancelTargetId === "all"
                ? "Are you sure you want to cancel all active transfers?"
                : "Are you sure you want to cancel this transfer?"}{" "}
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

export default FileTransfersList;
