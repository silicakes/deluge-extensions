import { useSignal, useComputed } from "@preact/signals";
import { displaySettings, DisplaySettings } from "../state";
import { usePersistDisplaySettings } from "../hooks/useDisplaySettingsPersistence";
import { useEffect, useRef } from "preact/hooks";
import { themePreference, ThemeType, setTheme } from "../lib/theme";

interface DisplayColorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  includeThemeControls?: boolean;
}

export function DisplayColorDrawer({
  isOpen = false,
  onClose,
  includeThemeControls = true,
}: DisplayColorDrawerProps) {
  const settings = useSignal<DisplaySettings>(displaySettings.value);
  const drawerRef = useRef<HTMLDivElement>(null);
  const currentTheme = useComputed(() => themePreference.value);

  // Set up persistence
  usePersistDisplaySettings();

  // Handle outside clicks to close drawer
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEscKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  // Handle setting updates
  const handleColorChange = (
    key: "foregroundColor" | "backgroundColor",
    value: string,
  ) => {
    displaySettings.value = {
      ...displaySettings.value,
      [key]: value,
    };
  };

  const handleCustomColorsToggle = (use7SegCustomColors: boolean) => {
    displaySettings.value = {
      ...displaySettings.value,
      use7SegCustomColors,
    };
  };

  const handleThemeChange = (theme: ThemeType) => {
    setTheme(theme);
  };

  // Early return if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed top-14 right-4 z-50"
      aria-modal="true"
      role="dialog"
      aria-label="Appearance Settings"
    >
      <div
        ref={drawerRef}
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg w-80 max-h-[90vh] overflow-y-auto"
        style={{
          animationName: "slideDown",
          animationDuration: "150ms",
          animationTimingFunction: "ease-out",
          animationFillMode: "both",
        }}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-lg font-semibold">Appearance Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--color-bg-hover)] cursor-pointer"
            aria-label="Close drawer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Theme controls section */}
          {includeThemeControls && (
            <section>
              <h3 className="text-sm font-medium mb-3">Theme</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    checked={currentTheme.value === "light"}
                    onChange={() => handleThemeChange("light")}
                    className="border-[var(--color-border)]"
                  />
                  <span>Light</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    checked={currentTheme.value === "dark"}
                    onChange={() => handleThemeChange("dark")}
                    className="border-[var(--color-border)]"
                  />
                  <span>Dark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    checked={currentTheme.value === "system"}
                    onChange={() => handleThemeChange("system")}
                    className="border-[var(--color-border)]"
                  />
                  <span>System</span>
                </label>
              </div>
            </section>
          )}

          {/* Display Colors section */}
          <section>
            <h3 className="text-sm font-medium mb-3">Display Colors</h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm">Foreground</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.value.foregroundColor}
                    onChange={(e) =>
                      handleColorChange(
                        "foregroundColor",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    aria-label="Foreground color"
                    className="w-8 h-8 border-0 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.value.foregroundColor}
                    onChange={(e) =>
                      handleColorChange(
                        "foregroundColor",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    className="flex-1 px-2 py-1 border border-[var(--color-border)] rounded font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm">Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.value.backgroundColor}
                    onChange={(e) =>
                      handleColorChange(
                        "backgroundColor",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    aria-label="Background color"
                    className="w-8 h-8 border-0 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.value.backgroundColor}
                    onChange={(e) =>
                      handleColorChange(
                        "backgroundColor",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    className="flex-1 px-2 py-1 border border-[var(--color-border)] rounded font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.value.use7SegCustomColors}
                    onChange={(e) =>
                      handleCustomColorsToggle(
                        (e.target as HTMLInputElement).checked,
                      )
                    }
                    className="border-[var(--color-border)]"
                  />
                  <span>Use custom for 7-segment</span>
                </label>
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={displaySettings.value.showPixelGrid}
                    onChange={(e) => {
                      displaySettings.value = {
                        ...displaySettings.value,
                        showPixelGrid: (e.target as HTMLInputElement).checked,
                      };
                    }}
                    className="border-[var(--color-border)]"
                    title="Toggle pixel grid (G)"
                  />
                  <span>Pixel grid</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
