# @norith/glimmer-* — Maintained Fork of Glimmer.js 2.0 Runtime

## Why This Fork Exists

The upstream `@glimmer/core`, `@glimmer/component`, `@glimmer/tracking` and related packages ([glimmerjs/glimmer.js](https://github.com/glimmerjs/glimmer.js)) are permanently frozen at `2.0.0-beta.21` — the Glimmer.js 2.0 beta was abandoned and no newer versions will ever be published. Projects using GlimmerX depend on these packages through the `@glimmerx/*` wrapper layer.

This fork exists to:

1. **Preserve the source** against upstream removal
2. **Enable debugging improvements** — the `@tracked` decorator and render loop live here, not in the wrapper layer
3. **Maintain compatibility** with evolving tooling (Node.js, TypeScript, Webpack versions)
4. **Publish under `@norith/*` scope** on npmjs.com

## What Changed From Upstream

### Package Renaming (Selective)

Only the 9 packages in THIS repo are renamed. Dependencies on `@glimmer/*` packages from the actively maintained [glimmer-vm](https://github.com/glimmerjs/glimmer-vm) repo are left unchanged.

| Upstream (this repo) | Fork |
|---|---|
| `@glimmer/core` | `@norith/glimmer-core` |
| `@glimmer/component` | `@norith/glimmer-component` |
| `@glimmer/tracking` | `@norith/glimmer-tracking` |
| `@glimmer/helper` | `@norith/glimmer-helper` |
| `@glimmer/modifier` | `@norith/glimmer-modifier` |
| `@glimmer/debug` | `@norith/glimmer-debug` |
| `@glimmer/babel-preset` | `@norith/glimmer-babel-preset` |
| `@glimmer/ssr` | `@norith/glimmer-ssr` |
| `@glimmer/blueprint` | `@norith/glimmer-blueprint` |

### Unchanged Dependencies (from glimmer-vm — Actively Maintained)

These are NOT renamed. They come from the Ember/Glimmer VM ecosystem and continue to receive releases:

`@glimmer/compiler`, `@glimmer/env`, `@glimmer/global-context`, `@glimmer/interfaces`, `@glimmer/manager`, `@glimmer/node`, `@glimmer/opcode-compiler`, `@glimmer/owner`, `@glimmer/program`, `@glimmer/reference`, `@glimmer/runtime`, `@glimmer/util`, `@glimmer/validator`, `@glimmer/vm-babel-plugins`

**Important:** These glimmer-vm dependencies are pinned at `0.84.0` because the beta.21 runtime generates and executes opcodes in that format. Upgrading them independently risks opcode/type incompatibilities and silent runtime failures.

### Backward Compatibility

The babel-preset supports both `@glimmer/core` and `@norith/glimmer-core` in its module resolution config, so consumer apps using npm aliases work correctly.

## Relationship to Other Forks

| Repo | What it contains |
|---|---|
| **This repo** (`snorith/glimmer.js`) | The actual runtime code — components, tracking, rendering |
| [`snorith/glimmer-experimental`](https://github.com/snorith/glimmer-experimental) | `@norith/glimmerx-*` thin wrappers that re-export from these packages |
| [`snorith/glint`](https://github.com/snorith/glint) | `@norith/glint-*` type-checking packages |

The dependency chain is: `@norith/glimmerx-component` → `@norith/glimmer-component` → `@glimmer/runtime` (glimmer-vm)

## Planned Improvements

### Tracking Error Debugging

The primary debugging pain point: `@tracked` property assertion errors surface with generic messages and no component or property context.

Planned changes in this repo:
- **`@norith/glimmer-tracking`** (`packages/@glimmer/tracking/src/tracked.ts`): Attach `debugKey` labels (format: `ClassName#propertyName`) to tracked tags via `@glimmer/validator`'s debug API
- **`@norith/glimmer-core`**: Enrich the render/revalidation loop to catch tracking assertion errors and re-throw with the component name
- Dev-mode only (`NODE_ENV !== 'production'`) — zero production overhead

## Publishing

Same setup as glimmer-experimental: Trusted Publishing (OIDC) via GitHub Actions `workflow_dispatch` with Major/Minor/Patch dropdown.

## Repository Structure

```
packages/
  @glimmer/              # Directory names kept as @glimmer for minimal diff
    babel-preset/        # @norith/glimmer-babel-preset
    blueprint/           # @norith/glimmer-blueprint
    component/           # @norith/glimmer-component
    core/                # @norith/glimmer-core
    debug/               # @norith/glimmer-debug
    helper/              # @norith/glimmer-helper
    modifier/            # @norith/glimmer-modifier
    ssr/                 # @norith/glimmer-ssr
    tracking/            # @norith/glimmer-tracking
  example-apps/          # Example apps (not published)
```
