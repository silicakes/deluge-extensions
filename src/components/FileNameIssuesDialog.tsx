import { signal } from "@preact/signals";
import { FilenameValidation } from "@/lib/filenameValidator";

export interface FileValidationResult {
  file: File;
  validation: FilenameValidation;
}

export const fileNameIssuesOpen = signal(false);
export const fileValidationResults = signal<FileValidationResult[]>([]);
export const fileIssuesCallback = signal<
  ((proceed: boolean, forceSanitize?: boolean) => void) | null
>(null);

export default function FileNameIssuesDialog() {
  if (!fileNameIssuesOpen.value) return null;

  const hasErrors = fileValidationResults.value.some(
    (r) => !r.validation.isValid,
  );

  const handleProceed = (forceSanitize: boolean = false) => {
    if (fileIssuesCallback.value) {
      fileIssuesCallback.value(true, forceSanitize);
    }
    fileNameIssuesOpen.value = false;
    fileValidationResults.value = [];
    fileIssuesCallback.value = null;
  };

  const handleCancel = () => {
    if (fileIssuesCallback.value) {
      fileIssuesCallback.value(false);
    }
    fileNameIssuesOpen.value = false;
    fileValidationResults.value = [];
    fileIssuesCallback.value = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start mb-4">
            <span className="text-2xl mr-3">{hasErrors ? "❌" : "⚠️"}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">
                Filename Issues Detected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {hasErrors ? (
                  <>
                    <strong className="text-red-600 dark:text-red-400">
                      ERROR:
                    </strong>{" "}
                    Some filenames contain illegal characters or have other
                    issues that will prevent them from being uploaded to the
                    Deluge.
                  </>
                ) : (
                  <>
                    <strong className="text-yellow-600 dark:text-yellow-400">
                      WARNING:
                    </strong>{" "}
                    Some filenames may cause issues with the Deluge filesystem.
                  </>
                )}
              </p>
            </div>
          </div>

          <div
            className={`border rounded p-3 mb-4 ${
              hasErrors
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
            }`}
          >
            <p
              className={`text-sm font-medium mb-2 ${
                hasErrors
                  ? "text-red-800 dark:text-red-200"
                  : "text-yellow-800 dark:text-yellow-200"
              }`}
            >
              The following files have issues:
            </p>
            <div className="space-y-3">
              {fileValidationResults.value.map(({ file, validation }) => (
                <div
                  key={file.name}
                  className="border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-start">
                    <span
                      className={
                        validation.isValid
                          ? "text-yellow-500 mr-2"
                          : "text-red-500 mr-2"
                      }
                    >
                      {validation.isValid ? "⚠️" : "❌"}
                    </span>
                    <div className="flex-1">
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-xs">
                        {file.name}
                      </code>

                      {validation.errors.length > 0 && (
                        <div className="mt-1">
                          {validation.errors.map((error, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-red-600 dark:text-red-400"
                            >
                              • {error}
                            </p>
                          ))}
                        </div>
                      )}

                      {validation.warnings.length > 0 && (
                        <div className="mt-1">
                          {validation.warnings.map((warning, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-yellow-600 dark:text-yellow-400"
                            >
                              • {warning}
                            </p>
                          ))}
                        </div>
                      )}

                      {validation.sanitized !== file.name && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          → Will be saved as:{" "}
                          <code className="bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded font-mono text-xs">
                            {validation.sanitized}
                          </code>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel Upload
            </button>
            {hasErrors ? (
              <button
                onClick={() => handleProceed(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Use Safe Names & Continue
              </button>
            ) : (
              <button
                onClick={() => handleProceed(false)}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Continue Anyway
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
