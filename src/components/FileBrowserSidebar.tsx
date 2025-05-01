import { lazy, Suspense } from "preact/compat";
import { useSignalEffect } from "@preact/signals";
import { fileBrowserOpen, midiOut } from "../state";

// Lazily load the FileBrowserTree component
const FileBrowserTree = lazy(() => import("./FileBrowserTree"));

export default function FileBrowserSidebar() {
  // Auto-close sidebar when MIDI is disconnected
  useSignalEffect(() => {
    if (fileBrowserOpen.value && midiOut.value === null) {
      fileBrowserOpen.value = false;
    }
  });

  return (
    <aside className="fixed inset-y-0 left-0 w-72 sm:w-80 bg-neutral-50 dark:bg-neutral-900 shadow-lg z-10">
      <header className="flex items-center justify-between p-2 border-b border-neutral-300 dark:border-neutral-700">
        <h2 className="font-semibold text-sm">SD Card</h2>
        <button
          aria-label="Close"
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => (fileBrowserOpen.value = false)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </header>
      <div className="overflow-y-auto h-[calc(100%-42px)]">
        <Suspense
          fallback={
            <div className="p-4 text-center">Loading file browser...</div>
          }
        >
          <FileBrowserTree />
        </Suspense>
      </div>
    </aside>
  );
}
