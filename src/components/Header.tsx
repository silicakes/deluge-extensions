import { ThemeSwitcher } from "./ThemeSwitcher";
import { MidiDeviceNavbar } from "./MidiDeviceNavbar";

export function Header() {
  return (
    <header className="w-full px-4 py-2 flex items-center bg-[var(--color-bg-offset)] shadow-sm border-b border-[var(--color-border)] sticky top-0 z-20">
      {/* Left: logo */}
      <div className="flex items-center gap-2">
        <img
          src="/DEx-logo.png"
          alt="DEx Logo"
          className="h-8 w-auto md:h-10"
        />
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          Deluge Extensions
        </h1>
      </div>

      {/* Center: MIDI device navbar */}
      <div className="flex-1 flex justify-center">
        <MidiDeviceNavbar />
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <ThemeSwitcher />
        <a
          href="https://dex.silicak.es"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline hidden sm:inline"
        >
          Live&nbsp;Demo
        </a>
        <a
          href="https://github.com/silicakes/deluge-extensions"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub Repo"
          className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {/* GitHub icon (SVG) lightweight inline */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.19-1.12-1.5-1.12-1.5-.91-.64.07-.63.07-.63 1 .07 1.52 1.05 1.52 1.05.9 1.58 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.13-4.55-5A4.03 4.03 0 015.5 8.1c-.13-.32-.57-1.6.1-3.34 0 0 1.05-.34 3.45 1.31a11.69 11.69 0 013.14-.43c1.07 0 2.16.15 3.14.44 2.4-1.66 3.45-1.31 3.45-1.31.67 1.74.24 3.02.12 3.34a4.03 4.03 0 011.07 2.8c0 3.88-2.33 4.73-4.55 5 .36.32.67.94.67 1.9 0 1.37-.01 2.47-.01 2.8 0 .26.18.58.69.48A10.02 10.02 0 0022 12.26C22 6.58 17.52 2 12 2z"
            />
          </svg>
        </a>
      </div>
    </header>
  );
}
