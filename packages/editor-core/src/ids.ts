let counter = 0;

/** Generate a short unique element id. */
export function newElementId(prefix = "el"): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

/** Reset id counter (tests only). */
export function resetElementIdCounter(): void {
  counter = 0;
}
