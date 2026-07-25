# Workspace layout

npm workspaces monorepo. Workspace packages are consumed as TypeScript source:
`exports` point at `src/*.ts`, there is no `dist/` and no build step, so nothing
depends on package build ordering.

| Path                          | Purpose                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/web/`                   | Next.js UI and API routes (`/api/generate`, `/api/refine`, `/api/download`, `/api/validate`, `/api/widget-source`) |
| `apps/desktop/`               | Tauri 2 desktop shell (native window around the web app; see [desktop-tauri.md](./desktop-tauri.md))               |
| `packages/generator/`         | Cursor SDK agent, prompt composition, validation, zip packaging, CLI                                               |
| `packages/shared/`            | Shared TS types, `@simulate` layout profiles, `drawSurface` contract                                               |
| `packages/sim-preview/`       | EdgeTX WASM runtime (`SimRuntime`), virtual SD card, CRSF telemetry bridge                                         |
| `packages/layout-verify/`     | Static Lua draw interpreter and overlap/geometry checks                                                            |
| `packages/editor-core/`       | Lua ↔ scene document model behind the visual editor                                                                |
| `knowledge/`                  | Radio profiles, telemetry catalogs, design guides                                                                  |
| `templates/`                  | `dashboard-starter.lua`, `INSTALL.md.tpl`                                                                          |
| `examples/`                   | Gold-standard reference widgets                                                                                    |
| `stubs/2.11/`                 | EdgeTX LuaLS stubs (committed; refresh via `npm run sync-stubs`)                                                   |
| `scripts/`                    | Setup and asset-sync scripts                                                                                       |
| `apps/web/public/sim/`        | EdgeTX WASM firmware (auto-fetched on `npm install` / `npm run dev`)                                               |
| `generated/`                  | **Gitignored** — agent-written widgets                                                                             |
| `dist-output/`                | **Gitignored** — packaged zips                                                                                     |
| `.cursor/rules/edgetx-lua.md` | Lua widget rules injected into generation prompts                                                                  |

## Conventions

- Relative imports carry real extensions (`./validate.ts`); `rewriteRelativeImportExtensions`
  handles emit for the one consumer that bundles (Next.js).
- Tests are colocated with the module they cover (`validate.ts` / `validate.test.ts`)
  and discovered by glob, so a new test file needs no script changes.
- Package tests run on Node's type stripping; web tests run through `tsx` because
  they resolve the `~/*` alias from `apps/web/tsconfig.json`.
- Compiler options live in `tsconfig.base.json`; every package and `apps/web`
  extends it.
