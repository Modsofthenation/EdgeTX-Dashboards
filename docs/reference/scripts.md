# Scripts

Requires Node **22.13+**. Generation requires `CURSOR_API_KEY`.

## Root

| Script                                               | What it does                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run setup`                                      | First-time setup: patch `@edgetx/simulator-ui`, sync LuaLS stubs, fetch TX15 WASM |
| `npm run setup:sim`                                  | Radio sim only: patch + fetch WASM                                                |
| `npm run dev`                                        | Web UI on http://localhost:3000 (fetches WASM first if missing)                   |
| `npm run build`                                      | Ensure WASM assets, then build `apps/web` (packages need no build)                |
| `npm test`                                           | Every workspace's `test` script                                                   |
| `npm run test:wasm`                                  | EdgeTX WASM harness only (needs firmware synced)                                  |
| `npm run typecheck`                                  | `tsc --noEmit` in every workspace                                                 |
| `npm run lint`                                       | oxlint over the repo                                                              |
| `npm run lint:fix`                                   | oxlint with autofixes applied                                                     |
| `npm run fmt` / `fmt:check`                          | Prettier write / CI check for `**/*.{ts,tsx,mjs,json,md,css}`                     |
| `npm run fmt:changed`                                | Prettier only git-changed files — run before commit/push                          |
| `npm run generate -- --protocol betaflight "prompt"` | CLI generation                                                                    |
| `npm run sync-stubs`                                 | Re-fetch `stubs/2.11/`                                                            |
| `npm run sync-wasm`                                  | Force re-download the TX15 WASM firmware                                          |
| `npm run reset-chats`                                | Drop the local SQLite chat history                                                |

## Focused verification

Run the narrowest thing that covers your change:

```bash
npm run test -w @widget-gen/generator        # one package
npm run typecheck -w @widget-gen/web         # one workspace

# one file
node --experimental-strip-types --test packages/generator/src/validate.test.ts
cd apps/web && npx tsx --test src/lib/luaPreviewEngine.test.ts
```

`SKIP_WASM_SYNC=1` skips the firmware download (CI without the sim).
