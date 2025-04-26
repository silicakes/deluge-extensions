import { theme } from '../state';
import { themePreference, setTheme, ThemeType } from '../lib/theme';

type ThemeSwitcherProps = {
  variant?: 'icon' | 'radio' | 'both';
  className?: string;
};

export function ThemeSwitcher({ 
  variant = 'icon', 
  className = '' 
}: ThemeSwitcherProps) {
  // Icon components
  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
    </svg>
  );

  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
      <path fill-rule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clip-rule="evenodd" />
    </svg>
  );

  const ComputerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
      <path fill-rule="evenodd" d="M2.25 5.25a3 3 0 013-3h13.5a3 3 0 013 3V15a3 3 0 01-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 01-.53 1.28h-9a.75.75 0 01-.53-1.28l.621-.622a2.25 2.25 0 00.659-1.59V18h-3a3 3 0 01-3-3V5.25zm1.5 0v9.75c0 .83.67 1.5 1.5 1.5h13.5c.83 0 1.5-.67 1.5-1.5V5.25c0-.83-.67-1.5-1.5-1.5H5.25c-.83 0-1.5.67-1.5 1.5z" clip-rule="evenodd" />
    </svg>
  );
  
  const handleToggle = () => {
    // Simple toggle between light/dark if in explicit mode
    if (themePreference.value !== 'system') {
      setTheme(themePreference.value === 'light' ? 'dark' : 'light');
    } else {
      // When in system mode, toggle away from system to explicit preference
      setTheme(theme.value === 'light' ? 'dark' : 'light');
    }
  };

  const handleRadioChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
  };

  return (
    <div class={`theme-switcher ${className}`}>
      {/* Icon toggle button */}
      {(variant === 'icon' || variant === 'both') && (
        <button
          type="button"
          onClick={handleToggle}
          class="p-2 rounded-full bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          aria-label={`Switch to ${theme.value === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme.value === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      )}

      {/* Radio group for all three options */}
      {(variant === 'radio' || variant === 'both') && (
        <div class="theme-radio-group flex items-center space-x-4 mt-2">
          <label class="flex items-center">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={themePreference.value === 'light'}
              onChange={() => handleRadioChange('light')}
              class="mr-1.5"
            />
            <SunIcon />
            <span class="ml-1">Light</span>
          </label>
          
          <label class="flex items-center">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={themePreference.value === 'dark'}
              onChange={() => handleRadioChange('dark')}
              class="mr-1.5"
            />
            <MoonIcon />
            <span class="ml-1">Dark</span>
          </label>
          
          <label class="flex items-center">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={themePreference.value === 'system'}
              onChange={() => handleRadioChange('system')}
              class="mr-1.5"
            />
            <ComputerIcon />
            <span class="ml-1">System</span>
          </label>
        </div>
      )}
    </div>
  );
}
