export {};
declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      getBySel(selector: string, ...args: unknown[]): Chainable<Subject>;
      getBySelLike(selector: string, ...args: unknown[]): Chainable<Subject>;
      getOLED(): Chainable<Subject>;
      get7Seg(): Chainable<Subject>;
    }
  }
}
