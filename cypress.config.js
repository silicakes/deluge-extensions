import { defineConfig } from "cypress";
import { initPlugin } from "cypress-plugin-snapshots/plugin";

export default defineConfig({
  chromeWebSecurity: false,
  e2e: {
    baseUrl: "http://localhost:5173",
    excludeSpecPattern: ["**/__snapshots__/*", "**/__image_snapshots__/*"],
    setupNodeEvents(on, config) {
      // implement node event listeners here
      initPlugin(on, config);
    },
  },
});
