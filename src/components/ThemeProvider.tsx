import { ComponentChildren, JSX } from "preact";
import { useEffect } from "preact/hooks";
import { toggleTheme, cycleTheme } from "../lib/theme";

type ThemeProviderProps = {
  children: ComponentChildren;
  floatingSwitch?: boolean;
};

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'T' key for toggle
      if (e.key === "t" || e.key === "T") {
        if (e.shiftKey) {
          // Shift+T cycles through all three modes
          cycleTheme();
        } else {
          // Regular T toggles between light/dark
          toggleTheme();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <>{children}</>;
}
