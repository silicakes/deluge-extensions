import "./index.css";
import "./styles/theme.css";
import { render } from "preact";
import { ThemeProvider } from "./components/ThemeProvider";
import { App } from "./components/App";

// Load auto-behavior effects (WebMIDI/polling)
import "./lib/auto";

const root = document.getElementById("app")!;

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
  root,
);
