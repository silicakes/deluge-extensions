import { FileEntry } from "../state";
import { JSX } from "preact";

// Custom icon components matching Heroicons style but with Preact compatibility
const FolderIcon = (props: JSX.SVGAttributes<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
  </svg>
);

const MicrophoneIcon = (props: JSX.SVGAttributes<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
    <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
  </svg>
);

const SpeakerWaveIcon = (props: JSX.SVGAttributes<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
    <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
  </svg>
);

const DocumentTextIcon = (props: JSX.SVGAttributes<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
      clipRule="evenodd"
    />
    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
  </svg>
);

const DocumentIcon = (props: JSX.SVGAttributes<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
  </svg>
);

// File extension to icon mapping
const ICON_URLS = {
  folder: "/icons/folder.svg",
  audio: "/icons/audio.svg",
  midi: "/icons/midi.svg",
  document: "/icons/document.svg",
  text: "/icons/text-document.svg",
  default: "/icons/file.svg",
};

/**
 * Returns an appropriate icon SVG based on the entry type and extension
 * @param entry FileEntry to determine icon for
 * @returns JSX element with the icon
 */
export function iconForEntry(entry: FileEntry) {
  // Check if it's a directory
  if ((entry.attr & 0x10) !== 0) {
    return <FolderIcon className="w-5 h-5 text-yellow-500" />;
  }

  // Get file extension
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";

  // Audio files
  if (["wav", "mp3", "ogg", "flac"].includes(ext)) {
    return <MicrophoneIcon className="w-5 h-5 text-blue-500" />;
  }

  // MIDI files
  if (["mid", "midi"].includes(ext)) {
    return <SpeakerWaveIcon className="w-5 h-5 text-green-500" />;
  }

  // Text/code files
  if (["txt", "xml", "json", "csv", "md", "yml", "yaml"].includes(ext)) {
    return <DocumentTextIcon className="w-5 h-5 text-gray-500" />;
  }

  // Default file icon
  return <DocumentIcon className="w-5 h-5 text-gray-400" />;
}

/**
 * Returns a URL string to an appropriate icon based on the entry type and extension
 * This is useful for img src attributes where JSX elements can't be used
 * @param entry FileEntry to determine icon for
 * @returns string URL to the icon
 */
export function iconUrlForEntry(entry: FileEntry): string {
  // Check if it's a directory
  if ((entry.attr & 0x10) !== 0) {
    return ICON_URLS.folder;
  }

  // Get file extension
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";

  // Audio files
  if (["wav", "mp3", "ogg", "flac"].includes(ext)) {
    return ICON_URLS.audio;
  }

  // MIDI files
  if (["mid", "midi"].includes(ext)) {
    return ICON_URLS.midi;
  }

  // Text/code files
  if (["txt", "xml", "json", "csv", "md", "yml", "yaml"].includes(ext)) {
    return ICON_URLS.text;
  }

  // Default file icon
  return ICON_URLS.default;
}
