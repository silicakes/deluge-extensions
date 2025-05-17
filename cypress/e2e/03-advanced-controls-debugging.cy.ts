/// <reference types="cypress" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/commands.ts" />

enum Elements {
  CONTROLS_TOGGLE = "advanced-controls-toggle",
  CONTROLS_PANEL = "advanced-controls-panel",
  REFRESH_BUTTON = "manual-refresh-button",
  PING_BUTTON = "ping-test-button",
  MONITOR_BUTTON = "monitor-button",
  MONITOR_STATUS = "monitor-status",
  FLIP_SCREEN_BUTTON = "flip-screen-button",
}

const openAdvancedControls = () => {
  const { CONTROLS_TOGGLE, CONTROLS_PANEL } = Elements;
  cy.getBySel(CONTROLS_TOGGLE).click();
  cy.getBySel(CONTROLS_PANEL).should("be.visible");
};
describe("Advanced Controls and Debugging", () => {
  const DELUGE_MIDI_PORT_NAME = "Deluge Port 1";

  beforeEach(() => {
    cy.visit("/");
    cy.clearLocalStorage();
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
  });

  it("1. Accessing Advanced Controls Drawer/Panel", () => {
    const { REFRESH_BUTTON, PING_BUTTON, MONITOR_BUTTON } = Elements;
    openAdvancedControls();
    cy.getBySel(REFRESH_BUTTON).should("be.visible");
    cy.getBySel(PING_BUTTON).should("be.visible");
    cy.getBySel(MONITOR_BUTTON).should("be.visible");
  });

  it("2. Manual Display Refresh Triggers", () => {
    const { CONTROLS_TOGGLE, REFRESH_BUTTON } = Elements;
    openAdvancedControls();
    cy.getOLED();
    cy.getBySel(REFRESH_BUTTON).click();
    cy.wait(500);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: { threshold: 0.001 },
    });
    cy.get7Seg();
    cy.getBySel(CONTROLS_TOGGLE).click();
    cy.getBySel(REFRESH_BUTTON).click();
    cy.wait(500);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: { threshold: 0.001 },
    });
  });

  it("3. UI Monitor Mode", () => {
    const { MONITOR_BUTTON, MONITOR_STATUS } = Elements;
    openAdvancedControls();
    cy.getBySel(MONITOR_BUTTON).click();
    // TODO: Perform manual actions on Deluge to change display
    cy.getBySel(MONITOR_STATUS).should("have.text", "MONITOR ON");
    cy.getBySel(MONITOR_BUTTON).click();
    cy.getBySel(MONITOR_STATUS).should("have.text", "MONITOR OFF");
  });

  it("4. Ping Test", () => {
    openAdvancedControls();
    const { PING_BUTTON } = Elements;
    cy.window()
      .its("console")
      .then((console) => {
        cy.spy(console, "log").as("log");
      });
    cy.getBySel(PING_BUTTON).click();
    cy.wait(500);
    cy.get("@log")
      .invoke("getCalls")
      .then((calls: { args: string[] }[]) => {
        const hasResponse = !!calls.find((call) => {
          if (typeof call.args[1] === "string") {
            return call.args[1].includes("^ping");
          }
          return false;
        });

        cy.wrap(hasResponse).should("be.true");
      });
  });

  it("5. Test flip screen", () => {
    openAdvancedControls();
    const { FLIP_SCREEN_BUTTON } = Elements;
    cy.getBySel(FLIP_SCREEN_BUTTON).click();
    cy.wait(500);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: { threshold: 0.001 },
      name: "Advanced Controls and Debugging 5. Test flip screen - 7SEG",
    });
    cy.getBySel(FLIP_SCREEN_BUTTON).click();
    cy.wait(500);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: { threshold: 0.001 },
      name: "Advanced Controls and Debugging 5. Test flip screen - OLED",
    });
  });
});
