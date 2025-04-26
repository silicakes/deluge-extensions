import { MidiDeviceSelector } from "./MidiDeviceSelector";
import { DisplayControls } from "./DisplayControls";
import { useEffect } from 'preact/hooks';
import { captureScreenshot, copyCanvasToBase64, toggleFullScreen, increaseCanvasSize, decreaseCanvasSize } from '../lib/display';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SysExConsole } from './SysExConsole';
import { DisplayStylePicker } from './DisplayStylePicker';
import { DisplayViewer } from "./DisplayViewer";

export function App() {
  // Register global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return; // ignore typing in inputs
      switch (e.key.toLowerCase()) {
        case 's':
          captureScreenshot();
          break;
        case 'c':
          copyCanvasToBase64();
          break;
        case 'f':
          toggleFullScreen();
          break;
        case '+':
        case '=': // usually same key with shift
          increaseCanvasSize();
          break;
        case '-':
          decreaseCanvasSize();
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="p-6 text-center">
      <img src="/DEx-logo.png" alt="DEX Logo" className="mx-auto mb-4" />
      <h1 className="text-3xl font-bold mb-4">Deluge Client</h1>
      <div className=" mx-auto space-y-4">
        <MidiDeviceSelector />
        <div className="flex justify-between items-center">
          <DisplayControls />
          <DisplayStylePicker compact={true} />
        </div>
        <DisplayViewer />
        <ThemeSwitcher />
        <DisplayStylePicker compact={false} />
      </div>
      <SysExConsole />
    </div>
  )
}
