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
import {
  helpOpen,
  fileBrowserOpen,
  displaySettings,
  midiOut,
  fileTransferInProgress,
} from "../state";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";
import { PixelSizeControls } from "./PixelSizeControls";
import { DisplayColorDrawer } from "./DisplayColorDrawer";
import { loadDisplaySettings } from "../hooks/useDisplaySettingsPersistence";
import { initMidi } from "@/commands";
import { selectDelugeDevice } from "@/lib/webMidi";
import { FileOverrideConfirmation } from "./FileOverrideConfirmation";
import { AdvancedDisplayControls } from "./AdvancedDisplayControls";
import { shortcuts, registerGlobalShortcuts } from "../lib/shortcuts";
import PreviewManager from "./PreviewManager";

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

  // Navigation guard for file transfers
  useEffect(() => {
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (fileTransferInProgress.value) {
        // This shows the browser's standard confirmation dialog
        e.preventDefault();
        // This is required for older browsers
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () =>
      window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, []);

  // Register global keyboard shortcuts
  useEffect(() => {
    // Configure shortcut actions
    const toggleColorDrawer = () => setColorDrawerOpen(!colorDrawerOpen);
    const togglePixelGrid = () => {
      displaySettings.value = {
        ...displaySettings.value,
        showPixelGrid: !displaySettings.value.showPixelGrid,
      };
    };
    const toggleFileBrowser = () => {
      // Only toggle file browser if a MIDI device is connected
      if (midiOut.value !== null) {
        fileBrowserOpen.value = !fileBrowserOpen.value;
      }
    };
    const toggleHelpOverlay = () => {
      helpOpen.value = !helpOpen.value;
    };

    // Set up shortcut actions
    shortcuts.forEach((shortcut) => {
      switch (shortcut.key) {
        case "s":
          shortcut.action = captureScreenshot;
          break;
        case "c":
          shortcut.action = copyCanvasToBase64;
          break;
        case "f":
          shortcut.action = fullscreen.toggle;
          break;
        case "b":
          shortcut.action = toggleFileBrowser;
          break;
        case "+":
        case "=":
          shortcut.action = increaseCanvasSize;
          break;
        case "-":
          shortcut.action = decreaseCanvasSize;
          break;
        case "d":
          shortcut.action = toggleColorDrawer;
          break;
        case "g":
          shortcut.action = togglePixelGrid;
          break;
        case "?":
          shortcut.action = toggleHelpOverlay;
          break;
        case "1":
          shortcut.action = () => selectDelugeDevice(0);
          break;
        case "2":
          shortcut.action = () => selectDelugeDevice(1);
          break;
        case "3":
          shortcut.action = () => selectDelugeDevice(2);
          break;
      }
    });

    // Register global shortcut handler
    const cleanup = registerGlobalShortcuts();
    return cleanup;
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

      {/* File Preview Manager - Debug wrapper to ensure it's rendering */}
      <div id="preview-manager-container">
        {console.log("About to render PreviewManager")}
        <PreviewManager />
        {console.log("PreviewManager rendered")}
      </div>
    </div>
  );
}
