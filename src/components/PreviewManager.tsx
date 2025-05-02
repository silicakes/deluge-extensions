import { previewFile, editingFileState } from "../state";
import { useEffect } from "preact/hooks";
import { lazy, Suspense } from "preact/compat";
import AudioPreview from "./AudioPreview";

// Lazily load the BasicTextEditorModal since it's not needed unless editing text
const BasicTextEditorModal = lazy(() => import("./BasicTextEditorModal"));

/**
 * Wrapper component that renders appropriate preview or editor based on file type and state
 */
export default function PreviewManager() {
  // Add debugging to monitor when preview state changes
  useEffect(() => {
    console.log("PreviewManager: previewFile value changed", previewFile.value);
  }, [previewFile.value]);

  // Monitor editing state changes
  useEffect(() => {
    console.log(
      "PreviewManager: editingFileState value changed",
      editingFileState.value,
    );
  }, [editingFileState.value]);

  // If a file is being edited, render the text editor
  if (editingFileState.value) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
            Loading editor...
          </div>
        }
      >
        <BasicTextEditorModal />
      </Suspense>
    );
  }

  // If no file is being previewed, render nothing
  if (!previewFile.value) return null;

  // We only handle audio previews now; text files go directly to editor
  if (previewFile.value.type === "audio") {
    try {
      return <AudioPreview />;
    } catch (error) {
      console.error("Error rendering audio preview:", error);
      return (
        <div className="text-red-500 p-4">
          Error rendering audio preview: {String(error)}
        </div>
      );
    }
  }

  // Should not reach here, but just in case
  return null;
}
