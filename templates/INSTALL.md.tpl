# Installing {{WIDGET_NAME}} on EdgeTX

Generated for **{{RADIO_NAME}}** ({{LCD_W}}×{{LCD_H}}) with **{{PROTOCOL_LABEL}}** telemetry.

## 1. Copy files to radio

1. Extract the zip file.
2. Copy the `WIDGETS/{{WIDGET_NAME}}/` folder to your radio SD card:
   - Path: `SD:/WIDGETS/{{WIDGET_NAME}}/main.lua`
3. If the zip includes `SCRIPTS/TOOLS/` or `SCRIPTS/TELEMETRY/` folders, copy those paths to the same locations on your SD card.
4. Safely eject the SD card and insert it into the radio (or use USB storage mode).

{{#COMPANION_SCRIPTS}}
{{COMPANION_BLOCK}}
{{/COMPANION_SCRIPTS}}

## 2. Discover telemetry sensors

{{#SETUP_NOTES}}
- {{.}}
{{/SETUP_NOTES}}

1. Power on your receiver and flight controller.
2. On the radio: **Model** → **Telemetry** page → **Discover new**.
3. Wait until all expected sensors appear.
4. If values show zero after adding the dashboard, restart the radio once.

{{#ROTORFLIGHT_NOTE}}
## Rotorflight: enable rf2bg

Rotorflight custom CRSF telemetry requires the `rf2bg` background script:

1. Copy `rf2bg.lua` from [Rotorflight Lua scripts](https://github.com/rotorflight/rotorflight-lua-scripts) to `SCRIPTS/FUNCTIONS/` on your SD card.
2. Create a **Special Function**: Run `rf2bg`, Repeat **On**.
3. Delete all telemetry sensors, then **Discover new** with the FC powered on.
{{/ROTORFLIGHT_NOTE}}

## 3. Add dashboard to main view

1. Press **TELE** (or navigate to main views).
2. Long-press or tap **Setup widgets**.
3. Tap an empty zone and select **{{WIDGET_NAME}}**.
4. Configure dashboard options if desired.

## 4. Full-screen mode (recommended for dashboards)

1. Long-press the widget area.
2. Select **Full screen** (or double-tap on touch radios).
3. To exit full-screen: long-press **RTN/Back**.

## 5. Verify it works on the radio

Use this checklist after install:

1. **Dashboard appears** in the widget picker under the name `{{WIDGET_NAME}}`.
2. **Full-screen layout** fills the display ({{LCD_W}}×{{LCD_H}}) without clipped text.
3. **Telemetry updates** — battery, link, and GPS values change when the model is connected (not stuck at zero).
4. **Companion scripts** (if included) run from SYS → Tools or Telemetry → Script as documented above.
5. **Survives restart** — power cycle the radio; dashboard reloads on your main view.

If the web preview looked correct but the radio shows zeros, run **Discover new** again and restart the radio.

## 6. Sensors used

{{#SENSORS}}
- **{{name}}** — {{description}} ({{unit}})
{{/SENSORS}}

## 7. Simulate in VS Code (optional)

Generated dashboards include EdgeTX Dev Kit annotations for in-editor WASM simulation:

1. Install **Lua** and **EdgeTX Dev Kit** extensions (see `.vscode/extensions.json`).
2. Run `npm run sync-stubs` if `stubs/2.11/` is missing.
3. Open `main.lua` in VS Code and run **EdgeTX: Set Radio Profile** (match {{RADIO_NAME}} / {{LCD_W}}×{{LCD_H}} when available).
4. Run **EdgeTX: Simulate Script** or **Watch Script** for live firmware simulation.
5. The `---@simulate` line controls which widget zone is used (full-screen: `Layout1x1 zone=0`).

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard not listed | Check folder name matches widget `name` field (max 10 chars) |
| All values zero | Run Discover new; restart radio |
| Layout clipped | Use full-screen mode; dashboard targets {{LCD_W}}×{{LCD_H}} |
| Missing Rotorflight sensors | Enable rf2bg special function; rediscover sensors |
| Tool script missing | Copy to `SCRIPTS/TOOLS/` and check filename matches menu entry |
