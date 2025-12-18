# Repository Guidelines

## Project Structure & Module Organization
- App source lives in `src/` with `components/` (UI), `hooks/` (logic hooks), `commands/` (SysEx/USB ops), `services/` (I/O + side effects), and `lib/` utilities. Entry is `src/main.tsx`, styles in `src/styles/` and `src/index.css`, PWA service worker in `src/sw.ts`.
- Tests sit in `src/test/` using Vitest + Testing Library; end-to-end specs live in `cypress/e2e/`. Static assets are in `public/` and `src/assets/`. Vite/Tailwind config is in `vite.config.ts` and `tailwind.config.js`.

## Build, Test, and Development Commands
- `yarn install` — install deps (repo targets Node >= 21.1 + Yarn 4; use `corepack enable` if needed).
- `yarn dev` — run Vite dev server (HMR on port 5173 by default).
- `yarn build` — production bundle to `dist/`.
- `yarn preview` — serve the built bundle locally.
- `yarn typecheck` — TypeScript no-emit check.
- `yarn test` / `yarn test:watch` — Vitest suite under `src/test/`.
- `yarn lint` — ESLint (Preact config).
- `yarn pwa-check` — ensures `dist/` contains `sw.js` and `manifest.webmanifest`.

## Coding Style & Naming Conventions
- TypeScript + Preact with TSX; prefer functional components. Component files and exports use `PascalCase`, hooks `useCamelCase`, utilities `camelCase`.
- Prettier formatting (2-space indent, semicolons on, single quotes via ESLint). Avoid orphaned default exports; favor named exports for reuse.
- Tailwind is used for layout/styling; keep variants/classes close to the elements they affect and co-locate component-specific styles with the component.

## Testing Guidelines
- Place unit/integration specs beside code in `src/test/` with `*.test.ts` or `*.test.tsx`. Prefer Testing Library queries over DOM selectors; stub network/USB surfaces in `services/`.
- E2E specs live in `cypress/e2e/`; use fixtures from `cypress/fixtures/` and add custom commands in `cypress/support/commands.ts`.
- Cover new user-visible behaviors and edge cases (file operations, PWA offline paths). Keep tests deterministic—mock time and random sources when relevant.

## Commit & Pull Request Guidelines
- Commit history mixes imperative statements and Conventional Commits (`feat: ...`, `Fix ...`). Prefer imperative, present-tense subjects; include a type prefix when it clarifies scope.
- Pull requests: describe the change and rationale, note affected areas (UI, file operations, PWA), link issues, and include before/after screenshots or recordings for UI tweaks. Call out test coverage added or why it is not needed.
