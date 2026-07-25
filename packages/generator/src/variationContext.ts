import type { LayoutArchetypeId } from "./layoutArchetype.ts";

let activeLayoutArchetype: LayoutArchetypeId | undefined;

/** Set before agent runs so validateWidget can apply archetype-scoped rules. */
export function setActiveLayoutArchetype(id: LayoutArchetypeId | undefined): void {
  activeLayoutArchetype = id;
}

export function getActiveLayoutArchetype(): LayoutArchetypeId | undefined {
  return activeLayoutArchetype;
}
