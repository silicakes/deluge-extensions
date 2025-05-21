import { signal, effect } from "@preact/signals";
import { theme } from "../state";

export type ThemeType = "light" | "dark" | "system";

// Local preference storage
export const themePreference = signal<ThemeType>(
  (localStorage.getItem("dex-theme-preference") as ThemeType) || "system",
);

// System preference detection
const systemPrefersDark = signal(
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

// Set up media query listener for system preferences
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
mediaQuery.addEventListener("change", (e) => {
  systemPrefersDark.value = e.matches;
});

// Effect to calculate the actual theme
effect(() => {
  const preference = themePreference.value;
  const actualTheme =
    preference === "system"
      ? systemPrefersDark.value
        ? "dark"
        : "light"
      : preference;

  // Update the global theme signal
  theme.value = actualTheme as "light" | "dark";

  // Update DOM (both class and data attribute for flexibility)
  const root = document.documentElement;
  // Apply data-theme to both <html> and <body> so CSS overrides work regardless of selector
  root.dataset.theme = actualTheme;
  document.body.dataset.theme = actualTheme;
  if (actualTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Persist user preference
  localStorage.setItem("dex-theme-preference", preference);
});

// Public API
export function setTheme(newTheme: ThemeType): void {
  themePreference.value = newTheme;
}

// Toggle between light and dark (respecting system mode)
export function toggleTheme(): void {
  if (themePreference.value === "system") {
    // When in system mode, toggle the calculated theme
    setTheme(theme.value === "light" ? "dark" : "light");
  } else {
    // When in explicit mode, just toggle between light/dark
    setTheme(themePreference.value === "light" ? "dark" : "light");
  }
}

// Cycle through all three modes
export function cycleTheme(): void {
  const modes: ThemeType[] = ["light", "dark", "system"];
  const currentIndex = modes.indexOf(themePreference.value);
  const nextIndex = (currentIndex + 1) % modes.length;
  setTheme(modes[nextIndex]);
}
