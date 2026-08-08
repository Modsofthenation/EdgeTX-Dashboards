# Third-party notices

This project is MIT-licensed (see [LICENSE](./LICENSE)). It also downloads and
runs third-party components with their own terms.

## EdgeTX firmware (WASM simulator)

EdgeTX radio firmware used for in-browser / desktop simulation is **GNU General
Public License v2.0** (GPLv2).

- Project: [EdgeTX](https://github.com/EdgeTX/edgetx)
- License: [GPLv2](https://github.com/EdgeTX/edgetx/blob/main/LICENSE)
- Corresponding source: build from the EdgeTX repository (tag / commit matching
  the firmware version shown under **Settings → Simulator**, typically 2.11 / 2.12)

Simulator `.wasm` binaries are **not** committed to this repository. They are
fetched at install / `npm run sync-wasm` / Settings → Download into
`apps/web/public/sim/` (gitignored). Redistributing those binaries (or a product
that ships them) requires complying with GPLv2, including offering corresponding
source for the EdgeTX build you distribute.

Override the download mirror with `EDGETX_WASM_BASE` if you host your own copy.

## EdgeTX Lua stubs / simulator UI

- Lua API stubs under `stubs/` are synced from EdgeTX tooling for editor
  completions and validation — see `stubs/README.md`.
- `@edgetx/simulator-ui` (npm) powers the interactive radio chrome; see that
  package’s license on npm / its upstream repository.

## Other dependencies

Runtime and UI dependencies (Next.js, React, Tailwind, shadcn/ui components,
Tauri, Cursor SDK, etc.) are declared in `package.json` / workspace
`package.json` files and carry their own licenses as published on npm.
