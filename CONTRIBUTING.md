# Contributing

Thanks for helping improve EdgeTX Dashboards.

## Development setup

```bash
npm install
npm run setup    # stubs + WASM firmware (or SKIP_WASM_SYNC=1 if offline)
npm run dev      # http://localhost:3000
```

Node **22.13+** is required. Generation needs an AI key in the environment or under **Settings → AI**.

## Workflow

1. Open an issue (or discussion) for larger changes before a big PR.
2. Branch from `main`: `cursor/<short-description>` or your usual fork branch.
3. Keep diffs focused — match existing style; no drive-by refactors.
4. Run the smallest relevant checks before pushing:

```bash
npm run fmt:changed && npm run fmt:check
npm run lint
# Example scoped tests:
node --experimental-strip-types --test apps/web/src/lib/apiSecurity.test.ts
npm run test -w @widget-gen/generator
```

Do not run full-repo `npm test` / `npm run build` unless you are changing CI or packaging.

## Packages

| Path                     | Role                             |
| ------------------------ | -------------------------------- |
| `apps/web`               | Next.js UI + API                 |
| `apps/desktop`           | Tauri 2 shell                    |
| `packages/generator`     | Agent, validation, zip packaging |
| `packages/shared`        | Types / layouts (no IO)          |
| `packages/sim-preview`   | EdgeTX WASM runtime              |
| `packages/editor-core`   | Lua ↔ scene model                |
| `packages/layout-verify` | Static draw checks               |

See [AGENTS.md](./AGENTS.md) and [docs/README.md](./docs/README.md) for deeper layout and Lua rules.

## Security

Read [SECURITY.md](./SECURITY.md) before changing API auth, file writes under `generated/`, or WASM download URLs. Never commit `.env`, API keys, or chat databases.

## License

By contributing, you agree your changes are licensed under the MIT License in [LICENSE](./LICENSE).
