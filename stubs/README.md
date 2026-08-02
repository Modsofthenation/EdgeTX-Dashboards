# EdgeTX LuaLS stubs

Lua Language Server definitions from [edgetx-stubs](https://github.com/JeffreyChix/edgetx-stubs), used with [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit) for IntelliSense and in-editor simulation.

## Sync stubs

```bash
npm run sync-stubs
```

This downloads stubs for every EdgeTX version in the Studio/Editor picker (**2.10**, **2.11**, **2.12**) into `stubs/<major.minor>/`, then rebuilds the browser autocomplete catalogs used by the Layout Lua source editor.

Override versions with `EDGETX_STUB_VERSIONS=2.11,2.12` (comma-separated major.minor).

## VS Code workflow

1. Install **Lua** (`sumneko.lua`) and **EdgeTX Dev Kit** extensions (see `.vscode/extensions.json`).
2. Run **EdgeTX: Set Radio Profile** — choose your radio and EdgeTX version.
3. Point `.luarc.json` `library` at the matching folder (default `stubs/2.11`).
4. Open any generated widget under `generated/<name>/main.lua`.
5. Use **EdgeTX: Simulate Script** or **Watch Script** for WASM firmware simulation.
6. The `---@simulate` annotation controls widget zone layout during simulation.

Generated widgets include:

```lua
---@type WidgetScript
---@simulate Layout1x1 zone=0
```
