// import { MidiDeviceSelector } from "./MidiDeviceSelector";
import { DisplayControls } from "./DisplayControls";
import { useEffect } from "preact/hooks";
import {
  captureScreenshot,
  copyCanvasToBase64,
  increaseCanvasSize,
  decreaseCanvasSize,
} from "../lib/display";
import * as fullscreen from "../lib/fullscreen";
import { Header } from "./Header";
import { SysExConsole } from "./SysExConsole";
import { DisplayStylePicker } from "./DisplayStylePicker";
import { DisplayViewer } from "./DisplayViewer";
import { Card } from "./Card";
import { ShortcutHelpOverlay } from "./ShortcutHelpOverlay";
import { helpOpen } from "../state";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";

export function App() {
  // Register global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.target && (e.target as HTMLElement).tagName === "INPUT") ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      )
        return; // ignore typing in inputs
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
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      <PwaUpdatePrompt />
      <Header />

      {/* Canvas placed outside the main container for unlimited growth in both directions */}
      <div className="w-full flex justify-center my-6">
        <DisplayViewer />
      </div>

      <main className="p-4 max-w-screen-lg mx-auto space-y-6">
        {/* Display controls and settings */}
        <Card title="Display Controls">
          {/* Toolbar & controls */}
          <div className="flex justify-between items-center flex-wrap gap-2 controls">
            <DisplayControls />
            <DisplayStylePicker compact={true} />
          </div>
        </Card>

        <SysExConsole />
      </main>

      {/* Render the ShortcutHelpOverlay */}
      <ShortcutHelpOverlay />
    </div>
  );
}
