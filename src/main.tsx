import "./index.css";
import "./styles/theme.css";
import { render } from "preact";
import { App } from "./components/App";
import { ThemeProvider } from "./components/ThemeProvider";
import "./lib/auto"; // Load auto-behavior effects

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
  document.getElementById("app")!,
);
