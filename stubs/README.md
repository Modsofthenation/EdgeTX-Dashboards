# EdgeTX LuaLS stubs

Lua Language Server definitions from [edgetx-stubs](https://github.com/JeffreyChix/edgetx-stubs), used with [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit) for IntelliSense and in-editor simulation.

## Sync stubs

```bash
npm run sync-stubs
```

This downloads version **2.11** stubs (matching TX15 / EdgeTX 2.11+) into `stubs/2.11/`.

## VS Code workflow

1. Install **Lua** (`sumneko.lua`) and **EdgeTX Dev Kit** extensions (see `.vscode/extensions.json`).
2. Run `EdgeTX: Set Radio Profile` — choose your radio and EdgeTX 2.11+.
3. Open any generated widget under `generated/<name>/main.lua`.
4. Use **EdgeTX: Simulate Script** or **Watch Script** for WASM firmware simulation.
5. The `---@simulate` annotation controls widget zone layout during simulation.

Generated widgets include:

```lua
---@type WidgetScript
---@simulate Layout1x1 zone=0
```
