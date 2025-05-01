import { updateAvailable, applyUpdate } from "../lib/pwa";
import { useState, useEffect } from "preact/hooks";

export function PwaUpdatePrompt() {
  const [visible, setVisible] = useState(false);

  // Watch the updateAvailable signal
  useEffect(() => {
    const unsubscribe = updateAvailable.subscribe((value) => {
      setVisible(value);
    });

    return () => unsubscribe();
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    applyUpdate();
    // Force reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2 bg-indigo-600 text-white shadow-md">
      <div className="flex w-full max-w-screen-lg flex-col sm:flex-row items-center sm:justify-between gap-2 px-4">
        <span className="text-sm sm:text-base">
          A new version is available!
        </span>
        <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
          <button
            onClick={() => setVisible(false)}
            className="px-3 py-1 text-xs sm:text-sm bg-indigo-700 hover:bg-indigo-800 rounded"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            className="px-3 py-1 text-xs sm:text-sm bg-white text-indigo-600 hover:bg-gray-100 rounded"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
