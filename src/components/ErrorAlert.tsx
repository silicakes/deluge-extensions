import { DelugeFileSystemError } from "../lib/delugeErrors";
import { getUserFriendlyError } from "../lib/userErrorMessages";

interface ErrorAlertProps {
  error: unknown;
  onDismiss?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export function ErrorAlert({ error, onDismiss, actions }: ErrorAlertProps) {
  const friendlyMessage = getUserFriendlyError(error);
  const technicalDetails =
    error instanceof Error ? error.message : String(error);

  return (
    <div className="error-alert bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">Operation Failed</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{friendlyMessage}</p>
          </div>

          <details className="mt-4">
            <summary className="text-sm text-red-600 cursor-pointer hover:underline">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs text-gray-700 bg-gray-100 p-2 rounded overflow-x-auto">
              {technicalDetails}
            </pre>
            {error instanceof DelugeFileSystemError && (
              <div className="mt-2 text-xs text-gray-600">
                <p>Error Code: {error.code}</p>
                <p>Command: {error.command}</p>
                {error.context && (
                  <pre className="mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                    Context: {JSON.stringify(error.context, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </details>

          <div className="mt-4 flex gap-2">
            {actions?.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {action.label}
              </button>
            ))}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
