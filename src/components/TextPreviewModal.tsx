import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { previewFile } from "../state";
import { readFile } from "@/commands";

/**
 * Text file preview modal component
 * Renders a centered modal with text content
 */
export default function TextPreviewModal() {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const content = useSignal<string>("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        previewFile.value = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Focus trap (for accessibility)
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  // Load text file when mounted
  useEffect(() => {
    // Ensure path is defined
    if (!previewFile.value || !previewFile.value.path) {
      console.error("Invalid preview file path");
      return;
    }

    const fileData = previewFile.value;

    async function loadTextFile() {
      try {
        loading.value = true;
        error.value = null;

        // Read file from device
        const buffer = await readFile(fileData);

        // Convert buffer to text
        const decoder = new TextDecoder("utf-8");
        let text = decoder.decode(buffer);

        // Handle special case for JSON - pretty print it
        if (fileData.path.toLowerCase().endsWith(".json")) {
          try {
            const json = JSON.parse(text);
            text = JSON.stringify(json, null, 2);
          } catch (jsonErr) {
            console.warn("Failed to format JSON:", jsonErr);
            // Continue with raw text if JSON parsing fails
          }
        }

        content.value = text;
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to load text file";
        console.error("Text preview error:", err);
      } finally {
        loading.value = false;
      }
    }

    loadTextFile();
  }, []);

  // Close the modal
  const handleClose = () => {
    previewFile.value = null;
  };

  // Close on backdrop click (but not when clicking the content)
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-preview-title"
    >
      <div
        ref={modalRef}
        className="bg-neutral-800 rounded-lg shadow-lg max-w-screen-md w-full max-h-[90vh] flex flex-col focus:outline-none"
        tabIndex={-1}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-700">
          <h2
            id="text-preview-title"
            className="text-lg font-medium text-neutral-100 truncate max-w-[80%]"
          >
            {previewFile.value?.path || "Text Preview"}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white p-1"
            aria-label="Close text preview"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-auto flex-1 p-4">
          {error.value ? (
            <div className="text-red-400">Error: {error.value}</div>
          ) : loading.value ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <pre className="text-neutral-100 p-2 max-w-full overflow-auto whitespace-pre-wrap break-all">
              {content.value}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
