import { signal } from "@preact/signals";

export const fileSpaceWarningOpen = signal(false);
export const filesWithSpacesNames = signal<string[]>([]);
export const spaceWarningCallback = signal<((proceed: boolean) => void) | null>(
  null,
);

export default function FileSpaceWarning() {
  if (!fileSpaceWarningOpen.value) return null;

  const handleProceed = () => {
    if (spaceWarningCallback.value) {
      spaceWarningCallback.value(true);
    }
    fileSpaceWarningOpen.value = false;
    filesWithSpacesNames.value = [];
    spaceWarningCallback.value = null;
  };

  const handleCancel = () => {
    if (spaceWarningCallback.value) {
      spaceWarningCallback.value(false);
    }
    fileSpaceWarningOpen.value = false;
    filesWithSpacesNames.value = [];
    spaceWarningCallback.value = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-start mb-4">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Files with Spaces Detected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <strong className="text-red-600 dark:text-red-400">
                  WARNING:
                </strong>{" "}
                The Deluge filesystem does not properly handle filenames with
                spaces. Uploading these files will cause:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-3 ml-2">
                <li className="text-red-600 dark:text-red-400 font-medium">
                  Files to become corrupted and inaccessible
                </li>
                <li className="text-red-600 dark:text-red-400 font-medium">
                  Single-letter entries with invalid attributes (attr: 47)
                </li>
                <li>Files won't appear in directory listings</li>
                <li>SD card may require disk repair to fix corruption</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                It's strongly recommended to rename these files before
                uploading:
              </p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              The following files contain spaces and will likely fail:
            </p>
            <ul className="space-y-1">
              {filesWithSpacesNames.value.map((name) => (
                <li key={name} className="flex items-center text-sm">
                  <span className="text-red-500 mr-2">✗</span>
                  <code className="bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded font-mono text-xs">
                    {name}
                  </code>
                  <span className="ml-2 text-gray-500">
                    → suggested:{" "}
                    <code className="bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded font-mono text-xs">
                      {name.replace(/\s+/g, "_")}
                    </code>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel Upload
            </button>
            <button
              onClick={handleProceed}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Upload Anyway (Not Recommended)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
