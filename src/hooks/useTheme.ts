import { theme } from '../state';
import { themePreference, setTheme, toggleTheme, cycleTheme, ThemeType } from '../lib/theme';

/**
 * Hook for accessing theme state and functions
 */
export function useTheme() {
  return {
    /** Current active theme ('light' or 'dark') */
    theme: theme.value,
    
    /** User preference ('light', 'dark', or 'system') */
    preference: themePreference.value,
    
    /** Set theme to a specific value */
    setTheme: (newTheme: ThemeType) => setTheme(newTheme),
    
    /** Toggle between light and dark themes */
    toggleTheme: () => toggleTheme(),
    
    /** Cycle through all theme options */
    cycleTheme: () => cycleTheme(),
    
    /** Check if current theme is dark mode */
    isDark: theme.value === 'dark',
    
    /** Check if current theme is light mode */
    isLight: theme.value === 'light',
    
    /** Check if current preference is system */
    isSystem: themePreference.value === 'system'
  };
} 