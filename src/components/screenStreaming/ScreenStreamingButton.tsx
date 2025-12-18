import { useState } from "preact/hooks";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import { ScreenStreamingModal } from "./ScreenStreamingModal";
import { screenStreamerStatus } from "@/services/screenStreamingStreamer";

export function ScreenStreamingButton() {
  const [open, setOpen] = useState(false);
  const active = screenStreamerStatus.value !== "idle";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center p-2 rounded-md ${
          active
            ? "text-green-600 dark:text-green-400"
            : "text-gray-600 dark:text-gray-300"
        } hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-blue-500`}
        aria-label="Screen streaming"
        title="Screen streaming"
      >
        <QrCodeIcon className="w-5 h-5" />
      </button>
      {open && <ScreenStreamingModal onClose={() => setOpen(false)} />}
    </>
  );
}

