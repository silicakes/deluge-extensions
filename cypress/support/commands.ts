/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
import "cypress-plugin-snapshots/commands";

// Add type definitions for custom commands to Cypress namespace
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-testid attribute.
       * @example cy.getBySel('submit-button')
       */
      getBySel(
        selector: string,
        options?: Partial<
          Cypress.Loggable &
            Cypress.Timeoutable &
            Cypress.Withinable &
            Cypress.Shadow
        >,
      ): Chainable<JQuery<HTMLElement>>;

      /**
       * Custom command to set the display to OLED.
       * Assumes a checkbox with data-testid="hidden-screen-toggle-checkbox" controls this.
       * @example cy.getOLED()
       */
      getOLED(): Chainable<JQuery<HTMLElement>>;

      /**
       * Custom command to set the display to 7-Segment.
       * Assumes a checkbox with data-testid="hidden-screen-toggle-checkbox" controls this.
       * @example cy.get7Seg()
       */
      get7Seg(): Chainable<JQuery<HTMLElement>>;
      // Note: toMatchImageSnapshot types should be provided by "cypress-plugin-snapshots/commands"
      // Add it explicitly if the import doesn't cover it for the linter
      toMatchImageSnapshot(options?: {
        imageConfig?: Record<string, unknown>;
        name?: string;
        json?: boolean;
      }): Chainable<null>;
    }
  }
}

Cypress.Commands.add(
  "getBySel",
  (
    selector: string,
    options?: Partial<
      Cypress.Loggable &
        Cypress.Timeoutable &
        Cypress.Withinable &
        Cypress.Shadow
    >,
  ) => {
    return cy.get(`[data-testid=${selector}]`, options);
  },
);

Cypress.Commands.add("getOLED", () => {
  // The .check() command yields the same subject it was given.
  // Since getBySel yields JQuery<HTMLElement>, this will also yield JQuery<HTMLElement>.
  return cy.getBySel("hidden-screen-toggle-checkbox").check({ force: true });
});

Cypress.Commands.add("get7Seg", () => {
  // The .uncheck() command yields the same subject it was given.
  return cy.getBySel("hidden-screen-toggle-checkbox").uncheck({ force: true });
});

// Cypress.Commands.add("getBySelLike", (selector, ...args) => {
//   return cy.get(`[data-test*=${selector}]`, ...args);
// });
