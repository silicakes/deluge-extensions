import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";

// Create signals to control the dialog and store file information
export const fileOverrideConfirmationOpen = signal(false);
export const filesToOverride = signal<string[]>([]);
export const confirmCallback = signal<((confirmed: boolean) => void) | null>(
  null,
);

export function FileOverrideConfirmation() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Close overlay handler (cancels the operation)
  const handleCancel = () => {
    if (confirmCallback.value) {
      confirmCallback.value(false);
      confirmCallback.value = null;
    }
    fileOverrideConfirmationOpen.value = false;
    filesToOverride.value = [];
  };

  // Confirm handler (proceeds with the operation)
  const handleConfirm = () => {
    if (confirmCallback.value) {
      confirmCallback.value(true);
      confirmCallback.value = null;
    }
    fileOverrideConfirmationOpen.value = false;
    filesToOverride.value = [];
  };

  // Close on Escape key
  useEffect(() => {
    if (!fileOverrideConfirmationOpen.value) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileOverrideConfirmationOpen.value]);

  // Focus trap
  useEffect(() => {
    if (!fileOverrideConfirmationOpen.value || !overlayRef.current) return;

    // Focus the heading when opened
    headingRef.current?.focus();

    // Save previously focused element
    const previousFocus = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when closed
      previousFocus?.focus?.();
    };
  }, [fileOverrideConfirmationOpen.value]);

  // Don't render anything if not open
  if (!fileOverrideConfirmationOpen.value) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-heading"
      ref={overlayRef}
      data-testid="conflict-dialog"
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="override-heading"
          className="text-xl font-bold mb-4 text-neutral-900 dark:text-white"
          ref={headingRef}
          tabIndex={-1}
        >
          Overwrite Existing Files?
        </h2>

        <p className="mb-4 text-neutral-700 dark:text-neutral-300">
          The following {filesToOverride.value.length === 1 ? "file" : "files"}{" "}
          already exist and will be overwritten:
        </p>

        <div className="max-h-48 overflow-y-auto mb-4 bg-neutral-100 dark:bg-neutral-900 p-2 rounded">
          <ul className="list-disc pl-5">
            {filesToOverride.value.map((file, index) => (
              <li
                key={index}
                className="text-neutral-800 dark:text-neutral-200 py-1 break-all"
              >
                {file}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white rounded"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            onClick={handleConfirm}
            data-testid="conflict-dialog-overwrite-button"
          >
            Overwrite
          </button>
        </div>
      </div>
    </div>
  );
}
