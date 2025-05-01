import { useEffect, useRef } from "preact/hooks";
import { globalShortcuts } from "../lib/shortcuts";
import { helpOpen } from "../state";

export function ShortcutHelpOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Close overlay handler
  const handleClose = () => {
    helpOpen.value = false;
  };

  // Close on Escape key
  useEffect(() => {
    if (!helpOpen.value) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [helpOpen.value]);

  // Focus trap
  useEffect(() => {
    if (!helpOpen.value || !overlayRef.current) return;

    // Focus the heading when opened
    headingRef.current?.focus();

    // Save previously focused element
    const previousFocus = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when closed
      previousFocus?.focus?.();
    };
  }, [helpOpen.value]);

  // Don't render anything if not open
  if (!helpOpen.value) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-heading"
      ref={overlayRef}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="shortcuts-heading"
          className="text-xl font-bold mb-4 text-gray-900 dark:text-white"
          ref={headingRef}
          tabIndex={-1}
        >
          Keyboard Shortcuts
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-gray-700 dark:text-gray-300">
                Action
              </th>
              <th className="text-right py-2 text-gray-700 dark:text-gray-300">
                Shortcut
              </th>
            </tr>
          </thead>
          <tbody>
            {globalShortcuts.map((shortcut, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2 text-gray-800 dark:text-gray-200">
                  {shortcut.description}
                </td>
                <td className="py-2 text-right">
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-mono text-sm">
                    {shortcut.keys}
                  </kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 text-right">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
