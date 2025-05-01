import { theme } from "../state";
import { useState } from "preact/hooks";
import { DisplayColorDrawer } from "./DisplayColorDrawer";

type ThemeSwitcherProps = {
  variant?: "icon" | "radio" | "both";
  className?: string;
};

export function ThemeSwitcher({
  variant = "icon",
  className = "",
}: ThemeSwitcherProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Icon components
  const SunIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-5 h-5"
    >
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
    </svg>
  );

  const MoonIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-5 h-5"
    >
      <path
        fill-rule="evenodd"
        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
        clip-rule="evenodd"
      />
    </svg>
  );

  // Open appearance drawer when clicking the icon
  const handleIconClick = () => {
    setIsDrawerOpen(true);
  };

  return (
    <div class={`theme-switcher ${className}`}>
      {/* Icon button - opens the appearance drawer */}
      {(variant === "icon" || variant === "both") && (
        <button
          type="button"
          onClick={handleIconClick}
          class="p-2 rounded-full bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors cursor-pointer"
          aria-label="Appearance settings"
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
        >
          {theme.value === "light" ? <MoonIcon /> : <SunIcon />}
        </button>
      )}

      {/* Radio group is no longer needed as it's moved to the DisplayColorDrawer */}

      {/* Render the DisplayColorDrawer with theme controls */}
      <DisplayColorDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        includeThemeControls={true}
      />
    </div>
  );
}
