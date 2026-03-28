# CLAUDE.md — snorith/glimmer.js

## What This Repo Is

Maintained fork of [glimmerjs/glimmer.js](https://github.com/glimmerjs/glimmer.js) — the Glimmer.js 2.0 beta runtime packages. Upstream is permanently frozen at `2.0.0-beta.21` with no further releases.

All packages are renamed from `@glimmer/*` to `@norith/glimmer-*` and published at version `1.0.0+` on npmjs.com under the `@norith` scope.

## Relationship to Other Forks

```
Consumer App
  └── @norith/glimmerx-*  (snorith/glimmer-experimental)  ← thin wrappers
        └── @norith/glimmer-*  (THIS REPO)                ← actual runtime
              └── @glimmer/* 0.84.0  (glimmer-vm)          ← actively maintained, NOT forked
  └── @norith/glint-*     (snorith/glint)                  ← template type checking
```

- **snorith/glimmer-experimental** depends on packages from THIS repo
- **snorith/glint** is independent (provides type checking)
- **glimmer-vm** (`@glimmer/runtime`, `@glimmer/validator`, etc.) is actively maintained upstream — NOT forked

## Packages

| Package | Description | Published |
|---|---|---|
| `@norith/glimmer-core` | Core rendering, component manager, template compilation | Yes |
| `@norith/glimmer-component` | Component base class, lifecycle hooks | Yes |
| `@norith/glimmer-tracking` | `@tracked` decorator, `@cached` decorator | Yes |
| `@norith/glimmer-helper` | Helper manager and factory | Yes |
| `@norith/glimmer-modifier` | DOM modifier support | Yes |
| `@norith/glimmer-debug` | Debug macros and utilities | Yes |
| `@norith/glimmer-babel-preset` | Babel preset for template compilation | Yes |
| `@norith/glimmer-ssr` | Server-side rendering | Yes |
| `@norith/glimmer-blueprint` | Ember CLI blueprint | Yes |

## Important: Selective Renaming

Only packages **in this repo** are renamed to `@norith/glimmer-*`. Dependencies on glimmer-vm packages (`@glimmer/runtime`, `@glimmer/validator`, `@glimmer/interfaces`, `@glimmer/compiler`, `@glimmer/env`, etc.) remain unchanged — they are from the actively maintained [glimmerjs/glimmer-vm](https://github.com/glimmerjs/glimmer-vm) repo.

When editing dependency references, do NOT rename `@glimmer/runtime`, `@glimmer/validator`, `@glimmer/interfaces`, `@glimmer/manager`, `@glimmer/opcode-compiler`, `@glimmer/owner`, `@glimmer/program`, `@glimmer/env`, `@glimmer/global-context`, `@glimmer/util`, `@glimmer/node`, `@glimmer/reference`, `@glimmer/compiler`, or `@glimmer/vm-babel-plugins`. These are external.

## Build

```bash
# Requires Node 20 (managed via mise — see .mise.toml)
yarn install        # Uses lockfile for consistent dependency resolution
yarn build          # Compiles TS to dist/commonjs and dist/modules in each package
```

The build script (`bin/build.js`) compiles TypeScript twice (ES2015 modules + CommonJS) then distributes output into each package's `dist/` directory.

## Key Source Locations

- **@tracked decorator**: `packages/@glimmer/tracking/src/tracked.ts`
- **@cached decorator**: `packages/@glimmer/tracking/src/cached.ts`
- **Render loop / component manager**: `packages/@glimmer/core/src/`
- **Component base class**: `packages/@glimmer/component/src/component.ts`
- **Babel preset (template compilation config)**: `packages/@glimmer/babel-preset/index.js`

## Backward Compatibility

The babel-preset supports both `@glimmer/core` and `@norith/glimmer-core` in its module resolution config. Consumer apps using npm aliases (e.g., `"@glimmer/core": "npm:@norith/glimmer-core@^1.0.0"`) will have their source code imports matched correctly.

## Publishing

Manual `workflow_dispatch` via `.github/workflows/publish.yml` — select Major/Minor/Patch. Uses `scripts/bump-version.js` to version all packages in lockstep, then `scripts/publish-packages.js` to publish.

## Accounts

- GitHub: `snorith`
- npmjs.com: `norith` (scope: `@norith`)
