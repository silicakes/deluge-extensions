import { useEffect, useRef, useState } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { editingFileState, pollingIntervalId, isSyncEnabled } from "../state";
import { readTextFile, writeTextFile } from "../lib/fileEditor";

/**
 * Editable text file component with polling for external changes
 * Adds basic text editing capabilities to the app
 */
export default function BasicTextEditorModal() {
  const loading = useSignal(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const externalChangeDetected = useSignal(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const maxLoadAttempts = 3;

  // Helper to get just the filename from the path
  const getFileName = (path: string) => path.split("/").pop() || path;

  // Close on Escape key if not dirty, otherwise prompt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop propagation for ALL keyboard events to prevent global shortcuts
      e.stopPropagation();

      // Save on Ctrl/Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editingFileState.value?.dirty) {
          saveChanges();
        }
      }

      // Close on Escape
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseAttempt();
      }
    };

    // Add keydown handler to the document to catch all keystrokes when the modal is open
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // Focus trap (for accessibility)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Setup polling when component mounts
  useEffect(() => {
    const startPolling = () => {
      if (pollingIntervalId.value) {
        clearInterval(pollingIntervalId.value);
      }

      // Use a longer polling interval (3 seconds instead of 500ms) to reduce SysEx traffic
      console.log(
        `[BasicTextEditor] Starting file polling with 3 second interval`,
      );
      // Poll immediately once, then start interval
      pollFile();
      const intervalId = window.setInterval(
        pollFile,
        3000,
      ) as unknown as number;
      pollingIntervalId.value = intervalId;

      return intervalId;
    };

    // Clean up polling on unmount
    const intervalId = startPolling();
    return () => {
      console.log(`[BasicTextEditor] Clearing polling interval`);
      clearInterval(intervalId);
      pollingIntervalId.value = null;
    };
  }, []);

  // Whenever the target path changes, reset retry counter so that
  // we start fresh for the new file.
  useEffect(() => {
    // Avoid redundant state updates
    setLoadAttempts(0);
  }, [editingFileState.value?.path]);

  // Load text file on initial mount, when the target path changes, or when we
  // increment the retry counter after a failed attempt.
  useEffect(() => {
    // Ensure path is defined
    if (!editingFileState.value?.path) {
      console.error("Invalid editing file path");
      return;
    }

    const path = editingFileState.value.path;
    console.log(
      `[BasicTextEditor] Loading file: ${path}, attempt: ${loadAttempts + 1}`,
    );

    async function loadTextFile() {
      if (loadAttempts >= maxLoadAttempts) {
        console.error(
          `[BasicTextEditor] Maximum load attempts (${maxLoadAttempts}) reached for ${path}`,
        );
        if (editingFileState.value) {
          editingFileState.value = {
            ...editingFileState.value,
            error: `Failed to load file after ${maxLoadAttempts} attempts. The file may be too large or corrupted.`,
          };
        }
        loading.value = false;
        return;
      }

      try {
        loading.value = true;

        console.log(`[BasicTextEditor] Reading file content for ${path}`);
        const text = await readTextFile(path);
        console.log(
          `[BasicTextEditor] File content loaded, length: ${text.length}`,
        );

        // Check if content is valid (allow empty string)
        if (text === null || text === undefined) {
          throw new Error("File content is null or undefined after reading.");
        }

        // Set initial and current content
        editingFileState.value = {
          ...editingFileState.value!,
          initialContent: text,
          currentContent: text,
          dirty: false,
        };

        // Update editor content directly - MOVED TO SEPARATE useEffect
        /*
        if (editorRef.current) {
          console.log(`[BasicTextEditor] Setting editor content`);
          editorRef.current.textContent = text;
          console.log(`[BasicTextEditor] Editor content set.`);
        } else {
          // This case should ideally not happen if the ref is set up correctly
          console.error(`[BasicTextEditor] Editor ref is null when trying to set content.`);
           throw new Error("Editor reference is not available.");
        }
        */
      } catch (err) {
        console.error(`[BasicTextEditor] Error loading file:`, err);

        if (editingFileState.value) {
          editingFileState.value = {
            ...editingFileState.value,
            error:
              err instanceof Error ? err.message : "Failed to load text file",
          };
        }

        // Retry loading if we haven't reached the maximum attempts
        if (loadAttempts < maxLoadAttempts - 1) {
          console.log(
            `[BasicTextEditor] Retrying file load, attempt ${loadAttempts + 2}/${maxLoadAttempts}`,
          );
          setLoadAttempts(loadAttempts + 1);
        }
      } finally {
        loading.value = false;
      }
    }

    // Start the loading process
    loadTextFile();
    // We re-run this effect whenever the retry counter changes.
  }, [editingFileState.value?.path, loadAttempts]);

  // Effect to set editor content AFTER loading is complete and content is available
  useEffect(() => {
    if (!loading.value && editorRef.current && editingFileState.value) {
      // Only update if the editor's current text doesn't match the state
      // This prevents resetting cursor position during typing
      if (
        editorRef.current.textContent !== editingFileState.value.currentContent
      ) {
        console.log(
          `[BasicTextEditor] Updating editor textContent from state (post-load/external change).`,
        );
        editorRef.current.textContent = editingFileState.value.currentContent;
      }
    }
  }, [loading.value, editingFileState.value?.currentContent]); // Rerun when loading finishes or content changes externally

  // Poll file for external changes
  const pollFile = async () => {
    if (!editingFileState.value?.path) return;

    // Skip polling if we're still loading OR if sync is disabled
    if (loading.value || !isSyncEnabled.value) {
      if (!isSyncEnabled.value) {
        console.log(`[BasicTextEditor] Skipping poll: Sync is disabled.`);
      } else {
        console.log(`[BasicTextEditor] Skipping poll while file is loading.`);
      }
      return;
    }

    try {
      const path = editingFileState.value.path;
      console.log(`[BasicTextEditor] Polling file for changes: ${path}`);
      const currentFileContent = await readTextFile(path);

      // Check if content has changed externally
      if (currentFileContent !== editingFileState.value.initialContent) {
        console.log(`[BasicTextEditor] External file change detected`);

        // If dirty, show conflict notification
        if (editingFileState.value.dirty) {
          externalChangeDetected.value = true;
        } else {
          // If not dirty, just update our content
          if (editorRef.current) {
            editorRef.current.textContent = currentFileContent;
          }

          editingFileState.value = {
            ...editingFileState.value,
            initialContent: currentFileContent,
            currentContent: currentFileContent,
          };
        }
      } else {
        console.log(`[BasicTextEditor] No external changes detected`);
      }
    } catch (error) {
      console.error(`[BasicTextEditor] Error polling file:`, error);
      // Don't update error state to avoid disrupting user
    }
  };

  // Handle input changes
  const handleInput = (e: Event) => {
    e.stopPropagation();

    if (!editingFileState.value || !editorRef.current) return;

    const newContent = editorRef.current.textContent || "";

    // Only mark as dirty if content actually changed
    if (newContent !== editingFileState.value.currentContent) {
      editingFileState.value = {
        ...editingFileState.value,
        currentContent: newContent,
        dirty: newContent !== editingFileState.value.initialContent,
      };
    }
  };

  // Add a keydown handler directly to the editor element
  const handleEditorKeyDown = (e: KeyboardEvent) => {
    // Stop propagation to prevent global shortcuts from triggering
    e.stopPropagation();
  };

  // Save changes to file
  const saveChanges = async () => {
    if (!editingFileState.value?.dirty) return;

    try {
      await writeTextFile(
        editingFileState.value.path,
        editingFileState.value.currentContent,
      );

      // Update state after successful save
      editingFileState.value = {
        ...editingFileState.value,
        initialContent: editingFileState.value.currentContent,
        dirty: false,
      };

      // Clear any external change detection
      externalChangeDetected.value = false;
    } catch (error) {
      console.error("Error saving file:", error);
      if (editingFileState.value) {
        editingFileState.value = {
          ...editingFileState.value,
          error: error instanceof Error ? error.message : "Failed to save file",
        };
      }
    }
  };

  // Handle attempts to close the editor
  const handleCloseAttempt = () => {
    if (editingFileState.value?.dirty) {
      if (confirm("You have unsaved changes. Discard changes?")) {
        closeEditor();
      }
    } else {
      closeEditor();
    }
  };

  // Close editor and clear state
  const closeEditor = () => {
    // Clear interval
    if (pollingIntervalId.value) {
      clearInterval(pollingIntervalId.value);
      pollingIntervalId.value = null;
    }

    // Clear editor state
    editingFileState.value = null;
  };

  // Handle external change conflict resolution
  const handleExternalChangeResolution = (keepLocal: boolean) => {
    if (!editingFileState.value) return;

    if (keepLocal) {
      // Keep local changes - just update initialContent to acknowledge external changes
      // but maintain the user's edits
      externalChangeDetected.value = false;
    } else {
      // Discard local changes and load external version
      pollFile().then(() => {
        if (editingFileState.value && editorRef.current) {
          editorRef.current.textContent = editingFileState.value.initialContent;
          editingFileState.value = {
            ...editingFileState.value,
            currentContent: editingFileState.value.initialContent,
            dirty: false,
          };
        }
        externalChangeDetected.value = false;
      });
    }
  };

  if (!editingFileState.value) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-neutral-800 shadow-lg z-50 border-t border-neutral-700"
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-editor-title"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col focus:outline-none" tabIndex={-1}>
        <div className="flex justify-between items-center p-2 border-b border-neutral-700">
          <h2
            id="text-editor-title"
            className="text-lg font-medium text-neutral-100 truncate max-w-[60%] flex items-center"
          >
            {getFileName(editingFileState.value.path)}
            {editingFileState.value.dirty && (
              <span className="ml-2 text-yellow-400">*</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={saveChanges}
              disabled={!editingFileState.value.dirty}
              className={`px-3 py-1 rounded text-sm ${
                editingFileState.value.dirty
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-800/50 text-neutral-400 cursor-not-allowed"
              }`}
              aria-label="Save changes"
            >
              Save
            </button>
            <div className="flex items-center gap-1">
              <label
                htmlFor="sync-toggle"
                className="text-xs text-neutral-400 flex items-center gap-1 cursor-pointer"
              >
                Sync:
                <input
                  id="sync-toggle"
                  type="checkbox"
                  className="form-checkbox h-4 w-4 rounded text-blue-600 bg-neutral-700 border-neutral-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  checked={isSyncEnabled.value}
                  onChange={(e: Event) => {
                    const target = e.target as HTMLInputElement;
                    isSyncEnabled.value = target.checked;
                    if (target.checked) {
                      // Immediately poll when sync is turned on
                      pollFile();
                    }
                  }}
                />
              </label>
            </div>
            <button
              onClick={handleCloseAttempt}
              className="text-neutral-400 hover:text-white p-1"
              aria-label="Close editor"
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
        </div>

        {/* External change conflict dialog */}
        {externalChangeDetected.value && (
          <div className="bg-yellow-700/50 p-3 border-b border-yellow-600">
            <p className="text-yellow-200 mb-2">
              This file has been modified outside the editor. What would you
              like to do?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExternalChangeResolution(true)}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded"
              >
                Keep my changes
              </button>
              <button
                onClick={() => handleExternalChangeResolution(false)}
                className="px-3 py-1 bg-neutral-600 hover:bg-neutral-700 rounded"
              >
                Discard my changes & reload
              </button>
            </div>
          </div>
        )}

        {/* Error message display */}
        {editingFileState.value.error && (
          <div className="bg-red-900/50 p-3 border-b border-red-800">
            <p className="text-red-200">
              Error: {editingFileState.value.error}
            </p>
          </div>
        )}

        {/* Loading indicator */}
        {loading.value ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div
            ref={editorRef}
            contentEditable="true"
            onInput={handleInput}
            onKeyDown={handleEditorKeyDown}
            className="p-4 overflow-auto whitespace-pre-wrap font-mono h-[40vh] max-h-[50vh] bg-neutral-900 text-neutral-100 focus:outline-none"
          />
        )}

        {/* Status bar */}
        <div className="p-2 text-xs text-neutral-400 border-t border-neutral-700 flex justify-between">
          <div>
            {editingFileState.value.dirty ? "Edited • Not saved" : "Saved"}
          </div>
          <div>Press Ctrl+S or Cmd+S to save</div>
        </div>
      </div>
    </div>
  );
}
