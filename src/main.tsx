import "./index.css";
import "./styles/theme.css";
import { render } from "preact";
import { ThemeProvider } from "./components/ThemeProvider";
import { normalizeRoomId } from "./lib/screenStreaming/roomCode";

const root = document.getElementById("app")!;

function getRoomIdFromPathname(pathname: string): string | null {
  const stripped = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!stripped) return null;

  const m1 = stripped.match(/^roomId=(.+)$/);
  if (m1) {
    try {
      return decodeURIComponent(m1[1] ?? "");
    } catch {
      return m1[1] ?? "";
    }
  }

  const m2 = stripped.match(/^room\/([^/]+)$/);
  if (m2) {
    try {
      return decodeURIComponent(m2[1] ?? "");
    } catch {
      return m2[1] ?? "";
    }
  }

  return null;
}

function getRoomIdFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get("roomId") ?? getRoomIdFromPathname(window.location.pathname);
  if (!raw) return null;
  const normalized = normalizeRoomId(raw);
  return normalized || null;
}

(async () => {
  const roomId = getRoomIdFromLocation();

  if (roomId) {
    const { ViewerApp } = await import("./components/screenStreaming/ViewerApp");
    render(
      <ThemeProvider>
        <ViewerApp roomId={roomId} />
      </ThemeProvider>,
      root,
    );
    return;
  }

  await import("./lib/auto"); // Load auto-behavior effects (WebMIDI/polling)
  const { App } = await import("./components/App");
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
    root,
  );
})();
