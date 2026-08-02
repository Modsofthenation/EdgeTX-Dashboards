/**
 * Editor/sim-only hot-reload shim.
 *
 * EdgeTX loads widget factories once at boot (see #7216), so rewriting
 * WIDGETS/<Name>/main.lua does nothing. Instead we register a tiny stable
 * main.lua that loadScript()s body.lua whenever gen.lua bumps — so the
 * virtual SD can hot-swap draw code without soft-restarting WASM.
 *
 * Never ship this shim in user download zips; it is sim-preview only.
 */

import { sanitizeWidgetFolderName } from "./virtualSd.ts";

export const HOT_BODY_FILE = "body.lua";
export const HOT_GEN_FILE = "gen.lua";

export function hotReloadPaths(folderName: string): {
  dir: string;
  shimPath: string;
  bodyPath: string;
  genPath: string;
} {
  const safe = sanitizeWidgetFolderName(folderName);
  const dir = `/WIDGETS/${safe}`;
  return {
    dir,
    shimPath: `${dir}/main.lua`,
    bodyPath: `${dir}/${HOT_BODY_FILE}`,
    genPath: `${dir}/${HOT_GEN_FILE}`,
  };
}

/** Tiny generation stamp read by the shim each refresh. */
export function buildHotReloadGenSource(generation: number): string {
  const gen = Math.max(0, Math.floor(generation));
  return `return ${gen}\n`;
}

/**
 * Stable widget factory. `folderName` must match the WIDGETS folder / name=
 * used by planWidgetDeploy (1–10 chars).
 *
 * Gen is polled from refresh() only — update/background use the cached mod
 * so we do not loadScript(gen.lua) on every EdgeTX callback.
 *
 * Body `options` are loaded once at module scope so EdgeTX registers the real
 * option defaults (ShowLink, etc.) instead of an empty table. On body gen
 * bumps we rebuild widget.options from the new defaults so COLOR edits
 * (BgColor / TextColor) from the editor take effect in radio preview.
 */
export function buildHotReloadShimSource(folderName: string): string {
  const safe = sanitizeWidgetFolderName(folderName);
  const paths = hotReloadPaths(safe);
  // loadScript paths are absolute on the virtual SD.
  const body = paths.bodyPath;
  const gen = paths.genPath;
  return `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "${safe}"
local BODY = "${body}"
local GEN = "${gen}"
local gen = -1
local mod = nil
local options = {}

local function defaultsFromOptions(optionDefs)
  local opts = {}
  if type(optionDefs) ~= "table" then
    return opts
  end
  for _, def in ipairs(optionDefs) do
    if type(def) == "table" and type(def[1]) == "string" then
      opts[def[1]] = def[3]
    end
  end
  return opts
end

-- Load body once for factory options (EdgeTX reads options at registration).
do
  local bchunk = loadScript(BODY, "Tx")
  if bchunk then
    local ok, m = pcall(bchunk)
    if ok and type(m) == "table" then
      mod = m
      if type(m.options) == "table" then
        options = m.options
      end
      local gchunk = loadScript(GEN, "Tx")
      if gchunk then
        local okg, g = pcall(gchunk)
        if okg and type(g) == "number" then
          gen = g
        end
      end
    end
  end
end

local function checkReload()
  local gchunk = loadScript(GEN, "Tx")
  if not gchunk then return mod end
  local ok, g = pcall(gchunk)
  if not ok or type(g) ~= "number" then return mod end
  if g == gen and mod ~= nil then return mod end
  local bchunk = loadScript(BODY, "Tx")
  if not bchunk then return mod end
  local ok2, m = pcall(bchunk)
  if ok2 and type(m) == "table" then
    mod = m
    gen = g
    if type(m.options) == "table" then
      options = m.options
    end
  end
  return mod
end

local function create(zone, opts)
  local m = checkReload()
  if m and type(m.create) == "function" then
    return m.create(zone, opts)
  end
  return { zone = zone, options = opts }
end

local function update(widget, opts)
  if mod and type(mod.update) == "function" then
    return mod.update(widget, opts)
  end
  widget.options = opts
  return widget
end

local function refresh(widget, event, touch)
  local prevGen = gen
  local m = checkReload()
  -- When body generation changes, re-run create into the live widget table
  -- so telemetry src caches match the new script (geometry-only edits still
  -- work even without this; structural create() changes need it).
  -- Rebuild options from the new body defaults so COLOR option edits
  -- (BgColor/TextColor) from the editor are not stuck on the previous value.
  if m and type(m.create) == "function" and gen ~= prevGen then
    local zone = widget.zone
    local opts = defaultsFromOptions(m.options)
    local fresh = m.create(zone, opts)
    if type(fresh) == "table" then
      for k in pairs(widget) do
        widget[k] = nil
      end
      for k, v in pairs(fresh) do
        widget[k] = v
      end
      widget.zone = zone
      widget.options = opts
    end
  end
  if m and type(m.refresh) == "function" then
    return m.refresh(widget, event, touch)
  end
end

local function background(widget)
  if mod and type(mod.background) == "function" then
    return mod.background(widget)
  end
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
  background = background,
}
`;
}
