/// <reference types="cypress" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/commands.ts" />

describe("Display Customization", () => {
  const DELUGE_MIDI_PORT_NAME = "Deluge Port 1"; // As per existing tests

  beforeEach(() => {
    cy.visit("/");
    cy.clearLocalStorage();
    // Connect to MIDI device before each test
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
    // Ensure OLED display is active for these tests by default
    // This might require a click if 7-segment was previously active or is default
    cy.getOLED();
  });

  it("1. Accessing Appearance Settings: opens appearance settings panel", () => {
    // Action: Click the "Appearance settings" button
    // Assuming 'appearance-settings-button' is the data-testid
    cy.getBySel("appearance-settings-button").click();

    // Expected Result:
    // - A settings panel/drawer/modal for display customization opens.
    //   (Check for visibility of the panel and some key controls within it)
    cy.getBySel("appearance-settings").should("be.visible");
    cy.getBySel("theme-picker-section").should("be.visible");
    cy.getBySel("foreground-color-picker").should("be.visible");
    cy.getBySel("background-color-picker").should("be.visible");
    cy.getBySel("use-custom-color-for-7seg-toggle").should("be.visible");
    cy.getBySel("pixel-grid-toggle").should("be.visible");
  });

  it("2. OLED Pixel Scaling (Size): changes OLED pixel size", () => {
    cy.getBySel("pixel-size-indicator")
      .invoke("text")
      .then((initialPixelSizeText) => {
        // Action: Increase pixel size
        cy.getBySel("increase-screen-size-button").click();
        cy.getBySel("pixel-size-indicator").should("contain.text", "6×6"); // Example: "10x10" - needs actual format
        // Action: Decrease pixel size
        cy.getBySel("decrease-screen-size-button").click();

        cy.getBySel("pixel-size-indicator").should(
          "contain.text",
          initialPixelSizeText,
        ); // Example: "10x10" - needs actual format
      });

    cy.getBySel("main-display")
      .invoke("width")
      .then((initialCanvasWidth) => {
        cy.getBySel("increase-screen-size-button").click();
        cy.getBySel("main-display")
          .invoke("width")
          .should("be.gt", initialCanvasWidth);
        cy.getBySel("decrease-screen-size-button").click();
      });

    cy.getBySel("main-display")
      .invoke("height")
      .then((initialCanvasHeight) => {
        cy.getBySel("increase-screen-size-button").click();
        cy.getBySel("main-display")
          .invoke("height")
          .should("be.gt", initialCanvasHeight);
        cy.getBySel("decrease-screen-size-button").click();
      });
    cy.getBySel("pixel-size-indicator").should("contain.text", "5×5"); // Example: "10x10" - needs actual format
  });

  it("3. OLED Foreground Color Customization: changes foreground color", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");

    // Action: Select/enter a new foreground color
    // The way to interact with color pickers can vary.
    // If it's an <input type="color">, we can .invoke('val', '#FF0000').trigger('input');
    // Or, if it's custom, might need to click and select from a palette.
    // Assuming a simple input field for hex color for now:

    cy.getBySel("foreground-color-picker")
      .invoke("val", "#FF0000")
      .click()
      .trigger("input"); // Red
    // cy.getBySel("foreground-color-picker-text")
    //   .invoke("val", "#FF0000")
    //   .trigger("input"); // Red

    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("foreground-color-picker-text").should("have.value", "#ff0000");
    //
    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("4. OLED Background Color Customization: changes background color", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");
    const GREEN = "#00ff00";

    // Action: Select/enter a new background color
    cy.getBySel("background-color-picker")
      .invoke("val", GREEN)
      .trigger("input");
    // cy.getBySel("background-color-pick.clear().type("#00FF00"); // Green
    // cy.getBySel("apply-settings-button").click();

    // Expected Result:
    // - Mirrored OLED display 'off' pixels (background) change color.
    // cy.get("oled-display-canvas").should('have.css', '--oled-background-color', '#00FF00'); // Example
    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("background-color-picker-text").should("have.value", GREEN);

    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("5. Simultaneous Color Customization: changes both colors", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");
    const BLUE = "#0000ff";
    const YELLOW = "#ffff00";

    // Action: Change both colors
    cy.getBySel("foreground-color-picker-text").clear().type(BLUE); // Blue
    cy.getBySel("background-color-picker-text").clear().type(YELLOW); // Yellow

    // Expected Result:
    // - Both colors update.
    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("foreground-color-picker").should("have.value", BLUE);
    cy.getBySel("background-color-picker").should("have.value", YELLOW);

    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("6. Settings Persistence: custom settings persist after refresh", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");

    // Apply custom settings
    cy.getBySel("increase-screen-size-button").click(); // Make a change to pixel size
    cy.getBySel("increase-screen-size-button").click(); // Make a change to pixel size
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("foreground-color-picker-text").clear().type("#ABCDEF");
    cy.getBySel("background-color-picker-text").clear().type("#123456");

    // Expected value for pixel size indicator after one increase (example, adjust as needed)
    // const expectedPixelSizeText = "9x9"; // This needs to be known or dynamically captured

    // cy.get("current-pixel-size-indicator").should("contain.text", expectedPixelSizeText);
    cy.getBySel("appearance-settings-button").click(); // re-open panel
    cy.getBySel("foreground-color-picker-text").should("have.value", "#ABCDEF"); // Check before reload
    cy.getBySel("background-color-picker-text").should("have.value", "#123456"); // Check before reload

    cy.reload();

    // Re-establish MIDI connection after reload
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getOLED();
    // Expected Result: Settings are loaded and active
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");
    // cy.get("current-pixel-size-indicator").should("contain.text", expectedPixelSizeText);
    cy.getBySel("foreground-color-picker").should("have.value", "#abcdef");
    cy.getBySel("background-color-picker").should("have.value", "#123456");

    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("7. Support 7Seg color change", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");

    cy.getBySel("foreground-color-picker-text").clear().type("#dadb0d");
    cy.getBySel("use-custom-color-for-7seg-toggle").check();
    cy.get7Seg();

    cy.reload();

    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("8. Support pixel grid toggle", () => {
    cy.getOLED();
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings").should("be.visible");
    cy.getBySel("pixel-grid-toggle").uncheck();

    cy.get("html.w-full > .h-full").click();
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });
});
