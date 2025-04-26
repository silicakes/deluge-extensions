import "./index.css";
import "./styles/theme.css";
import { render } from "preact";
import { App } from "./components/App";
import { ThemeProvider } from "./components/ThemeProvider";
import "./lib/autoDisplay"; // Load auto-display effect

render(
  <ThemeProvider>
    <App />
  </ThemeProvider>, 
  document.getElementById("app")!
);
