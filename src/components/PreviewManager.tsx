import { previewFile } from "../state";
import { useEffect } from "preact/hooks";

// Define simple fallback components
function SimpleAudioPreview() {
  const handleClose = () => {
    previewFile.value = null;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-800 text-white border-t border-neutral-700">
      <div className="flex justify-between mb-2">
        <div>Audio Preview: {previewFile.value?.path}</div>
        <button
          onClick={handleClose}
          className="text-neutral-400 hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="h-8 bg-neutral-700 rounded flex items-center justify-center">
        Audio player would appear here
      </div>
    </div>
  );
}

function SimpleTextPreview() {
  const handleClose = () => {
    previewFile.value = null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-neutral-800 rounded-lg p-4 text-white max-w-screen-md w-full">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-medium">
            Text Preview: {previewFile.value?.path}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="bg-neutral-700 p-4 rounded">
          Text content would appear here
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper component that renders appropriate preview based on file type
 */
export default function PreviewManager() {
  // Add debugging to monitor when preview state changes
  useEffect(() => {
    console.log("PreviewManager: previewFile value changed", previewFile.value);
  }, [previewFile.value]);

  // Log render attempts
  console.log("PreviewManager rendering, previewFile =", previewFile.value);

  // If no file is being previewed, render nothing
  if (!previewFile.value) return null;

  // Log which preview type we're about to render
  console.log(
    `Rendering ${previewFile.value.type} preview for ${previewFile.value.path}`,
  );

  try {
    // Render appropriate preview component based on file type
    return previewFile.value.type === "audio" ? (
      <SimpleAudioPreview />
    ) : (
      <SimpleTextPreview />
    );
  } catch (error) {
    console.error("Error rendering preview:", error);
    return (
      <div className="text-red-500 p-4">
        Error rendering preview: {String(error)}
      </div>
    );
  }
}
