import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { previewFile } from "../state";
import { readFile } from "../lib/midi";
import { getMimeType } from "../lib/fileType";

/**
 * Audio preview player component
 * Displays at the bottom of the screen with audio controls
 */
export default function AudioPreview() {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const audioUrl = useSignal<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }
    };
  }, []);

  // Load audio file when mounted
  useEffect(() => {
    // Ensure path is defined
    if (!previewFile.value || !previewFile.value.path) {
      console.error("Invalid preview file path");
      return;
    }

    const path = previewFile.value.path;

    async function loadAudio() {
      try {
        loading.value = true;
        error.value = null;

        // Read file from device
        const buffer = await readFile(path);

        // Create blob URL
        const blob = new Blob([buffer], { type: getMimeType(path) });
        const url = URL.createObjectURL(blob);

        // Set audio source
        audioUrl.value = url;

        // If we have a reference to the audio element, set it to autoplay
        if (audioRef.current) {
          audioRef.current.play().catch((e) => {
            console.warn("Autoplay failed:", e);
          });
        }
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : "Failed to load audio";
        console.error("Audio preview error:", err);
      } finally {
        loading.value = false;
      }
    }

    loadAudio();
  }, []);

  // Handle closing the preview
  const handleClose = () => {
    previewFile.value = null;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-2 bg-neutral-800 border-t border-neutral-700 flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-neutral-300 truncate max-w-[85%]">
          {loading.value ? "Loading..." : previewFile.value?.path || ""}
        </span>
        <button
          onClick={handleClose}
          className="text-neutral-400 hover:text-white p-1"
          aria-label="Close audio preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {error.value ? (
        <div className="text-red-400 text-sm p-2">Error: {error.value}</div>
      ) : loading.value ? (
        <div className="flex justify-center items-center h-10">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <audio
          ref={audioRef}
          controls
          src={audioUrl.value || undefined}
          className="w-full h-10"
        />
      )}
    </div>
  );
}
