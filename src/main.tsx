import "./index.css";
import "./styles/theme.css";
import { render } from "preact";
import { ThemeProvider } from "./components/ThemeProvider";
import { normalizeRoomId } from "./lib/screenStreaming/roomCode";

const root = document.getElementById("app")!;

function getRoomIdFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("roomId");
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
