# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript app. Application code lives in `src/`.
Use the existing module boundaries:

- `src/routes/` for top-level screens.
- `src/components/` for reusable UI, grouped by feature.
- `src/state/` for Zustand stores.
- `src/storage/` for Dexie/IndexedDB persistence.
- `src/canvas/` for canvas camera and rendering code.
- `src/lib/` for small pure helpers.
- `public/` for static assets.
- `portable/`, `launchers/`, and `scripts/package-release.mjs` for the local-server release package and updater.

Generated folders such as `dist/`, `release/`, and `node_modules/` are ignored and should not be committed.

## Build, Test, and Development Commands

- `npm ci` installs dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server.
- `npm run start` serves the built app through the fixed local server at `http://127.0.0.1:58137`.
- `npm run build` runs TypeScript build checks and creates `dist/`.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run package:release` builds and writes release assets under `release/`.

Use Node.js 20 or newer.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and existing Tailwind utility patterns. Keep indentation at two spaces. Components use `PascalCase` filenames, hooks/stores use camelCase exports such as `useEditorStore`, and helper modules use concise camelCase names like `loadImage.ts`.

Prefer small, feature-local components over broad shared abstractions. Keep comments sparse and only for non-obvious logic.

## Testing Guidelines

There is no dedicated test framework in this repo yet. Before submitting changes, run:

```bash
npm run typecheck
npm run build
```

For release or updater changes, also run:

```bash
npm run package:release
unzip -t release/grid-map-builder-portable-v*.zip
```

Manually verify local-server behavior at `127.0.0.1:58137` when touching `portable/`, updater UI, or storage behavior.

## Commit & Pull Request Guidelines

Current history uses short imperative commit messages, for example `Add npm start command`. Keep commits focused and avoid bundling unrelated refactors.

Pull requests should include a brief summary, verification commands run, and screenshots or screen recordings for visible UI changes. Link issues when applicable. Never include local user data, `.claude/`, `.DS_Store`, `dist/`, `release/`, or `node_modules/`.

## Storage & Release Notes

User projects are stored in browser IndexedDB for `http://127.0.0.1:58137`. Preserve that fixed origin unless intentionally planning a data migration. Bump `package.json` version before publishing update-capable releases.

For update-capable GitHub releases, use the previous release naming style:
tag `vX.Y.Z`, release title `Grid Map Builder vX.Y.Z`, and upload
`release/grid-map-builder-portable-vX.Y.Z.zip`,
`release/grid-map-builder-update-vX.Y.Z.tgz`, and `release/checksums.txt`.
Run `npm run package:release` after the version bump so the update manifest and
asset names match the new tag.
