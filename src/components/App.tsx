// import { MidiDeviceSelector } from "./MidiDeviceSelector";
import { useEffect, useState } from "preact/hooks";
import { Suspense, lazy } from "preact/compat";
import {
  captureScreenshot,
  copyCanvasToBase64,
  increaseCanvasSize,
  decreaseCanvasSize,
} from "../lib/display";
import * as fullscreen from "../lib/fullscreen";
import { Header } from "./Header";
import { SysExConsole } from "./SysExConsole";
import { DisplayViewer } from "./DisplayViewer";
import { ShortcutHelpOverlay } from "./ShortcutHelpOverlay";
import { helpOpen, fileBrowserOpen, displaySettings, midiOut } from "../state";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";
import { PixelSizeControls } from "./PixelSizeControls";
import { DisplayColorDrawer } from "./DisplayColorDrawer";
import { loadDisplaySettings } from "../hooks/useDisplaySettingsPersistence";
import { initMidi } from "../lib/midi";
import { FileOverrideConfirmation } from "./FileOverrideConfirmation";
import { AdvancedDisplayControls } from "./AdvancedDisplayControls";

// Lazily load the file browser sidebar
const FileBrowserSidebar = lazy(() => import("./FileBrowserSidebar"));

export function App() {
  const [colorDrawerOpen, setColorDrawerOpen] = useState(false);

  // Load display settings from localStorage on mount
  useEffect(() => {
    loadDisplaySettings();
  }, []);

  // Initialize MIDI on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initMidi(true);
      } catch (err) {
        console.error("MIDI initialization failed:", err);
      }
    };
    init();
  }, []);

  // Register global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in any input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return; // Ignore shortcuts when typing in any input or textarea
      }

      switch (e.key.toLowerCase()) {
        case "s":
          captureScreenshot();
          break;
        case "c":
          copyCanvasToBase64();
          break;
        case "f":
          fullscreen.toggle();
          break;
        case "b":
          // Only toggle file browser if a MIDI device is connected
          if (midiOut.value !== null) {
            fileBrowserOpen.value = !fileBrowserOpen.value;
          }
          break;
        case "+":
        case "=": // usually same key with shift
          increaseCanvasSize();
          break;
        case "-":
          decreaseCanvasSize();
          break;
        case "?":
          helpOpen.value = !helpOpen.value;
          break;
        case "d": // New shortcut for Display colors
          setColorDrawerOpen(!colorDrawerOpen);
          break;
        case "g": // Toggle pixel grid
          displaySettings.value = {
            ...displaySettings.value,
            showPixelGrid: !displaySettings.value.showPixelGrid,
          };
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [colorDrawerOpen]);

  return (
    <div className="app-container">
      <PwaUpdatePrompt />
      <Header />

      {/* Container that shifts content when sidebar is open */}
      <div
        className={`transition-all duration-300 ${fileBrowserOpen.value ? "ml-72 sm:ml-80" : ""}`}
      >
        {/* Pixel Size Controls - Always visible above canvas */}
        <div className="w-full max-w-screen-lg mx-auto px-4 mt-3">
          <PixelSizeControls />
        </div>

        {/* Canvas placed outside the main container for unlimited growth in both directions */}
        <div className="w-full flex justify-center my-6">
          <DisplayViewer />
        </div>

        <main className="p-4 max-w-screen-lg mx-auto space-y-6">
          {/* Advanced display controls */}
          <AdvancedDisplayControls />

          <SysExConsole />
        </main>
      </div>

      {/* Conditionally render the file browser sidebar */}
      {fileBrowserOpen.value && (
        <Suspense fallback={null}>
          <FileBrowserSidebar />
        </Suspense>
      )}

      {/* Display Color Drawer */}
      <DisplayColorDrawer
        isOpen={colorDrawerOpen}
        onClose={() => setColorDrawerOpen(false)}
      />

      {/* Render the ShortcutHelpOverlay */}
      {helpOpen.value && <ShortcutHelpOverlay />}

      {/* File Override Confirmation Dialog */}
      <FileOverrideConfirmation />
    </div>
  );
}
