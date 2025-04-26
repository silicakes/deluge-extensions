import { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { toggleTheme, cycleTheme } from '../lib/theme';
import { ThemeSwitcher } from './ThemeSwitcher';

type ThemeProviderProps = {
  children: ComponentChildren;
  floatingSwitch?: boolean;
};

export function ThemeProvider({ 
  children, 
  floatingSwitch = true 
}: ThemeProviderProps): JSX.Element {
  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input/textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'T' key for toggle
      if (e.key === 't' || e.key === 'T') {
        if (e.shiftKey) {
          // Shift+T cycles through all three modes
          cycleTheme();
        } else {
          // Regular T toggles between light/dark
          toggleTheme();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      {children}
      {floatingSwitch && (
        <div class="fixed bottom-4 right-4 z-50">
          <ThemeSwitcher variant="icon" />
        </div>
      )}
    </>
  );
} 