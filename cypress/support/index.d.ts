export {};
declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      getBySel(selector: string, ...args: unknown[]): Chainable<Subject>;
      getBySelLike(selector: string, ...args: unknown[]): Chainable<Subject>;
      getOLED(): Chainable<Subject>;
      get7Seg(): Chainable<Subject>;
      toMatchImageSnapshot(options?: {
        imageConfig?: Record<string, unknown>;
        name?: string;
        json?: boolean;
      }): Chainable<null>;
    }
  }
}
