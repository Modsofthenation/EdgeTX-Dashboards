---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Manual QA fixture: open in Radio sim (fullscreen) and confirm cyan annulus ring.
-- Preview tab should also show the ring via luaPreviewEngine.

local function create()
  return {}
end

local function refresh()
  lcd.clear()
  lcd.drawFilledRectangle(0, 0, 480, 320, GREY)
  lcd.drawAnnulus(240, 160, 72, 52, 0, 270, CYAN, 0)
  lcd.drawAnnulus(240, 160, 72, 52, 270, 90, DARKGREY, 0)
  lcd.drawText(188, 152, "ANNULUS QA", SMLSIZE + WHITE)
end

return {
  name = "AnnulusQA",
  create = create,
  refresh = refresh,
}
