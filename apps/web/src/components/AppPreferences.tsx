"use client";

import Link from "next/link";
import { useEffect } from "react";

export type PreferencesTab = "appearance" | "ai" | "simulator" | "defaults";

export const OPEN_PREFERENCES_EVENT = "widget-gen:open-preferences";

export type OpenPreferencesDetail = {
  tab?: PreferencesTab;
};

/** Navigate to the Settings page (replaces the old Preferences modal). */
export function openAppPreferences(tab: PreferencesTab = "appearance"): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams({ tab });
  window.location.assign(`/settings?${params.toString()}`);
}

/**
 * Legacy host — preferences are now a routed page.
 * Kept so existing mounts do not crash; redirects on event.
 */
export function AppPreferencesHost() {
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenPreferencesDetail>).detail;
      openAppPreferences(detail?.tab ?? "appearance");
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
  }, []);
  return null;
}

export function AppPreferencesButton({ className }: { className?: string }) {
  return (
    <Link href="/settings?tab=appearance" className={className}>
      Settings
    </Link>
  );
}
