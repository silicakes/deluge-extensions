import { fileBrowserOpen, midiOut } from "../state";

export default function FileBrowserToggleButton() {
  return (
    <button
      data-testid="file-browser-toggle-button"
      aria-label="Open file browser"
      className="p-1 focus:outline-none rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={midiOut.value === null}
      onClick={() => (fileBrowserOpen.value = true)}
      title={
        midiOut.value === null ? "Connect MIDI device first" : "Browse SD Card"
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
      >
        <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
      </svg>
    </button>
  );
}
