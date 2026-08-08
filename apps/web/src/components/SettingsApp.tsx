"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "~/components/AppShell";
import { AiSettingsPanel } from "~/components/AiSettingsPanel";
import { SimFirmwarePanel } from "~/components/SimFirmwarePanel";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useTheme } from "~/lib/theme/ThemeProvider";
import { THEME_OPTIONS, type ThemeId } from "~/lib/theme/themes";
import { cn } from "~/lib/utils";
import type { PreferencesTab } from "~/components/AppPreferences";

const TABS: { id: PreferencesTab | "defaults"; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI providers" },
  { id: "simulator", label: "Simulator" },
  { id: "defaults", label: "Defaults" },
];

function isTab(value: string | null): value is PreferencesTab | "defaults" {
  return (
    value === "appearance" ||
    value === "ai" ||
    value === "simulator" ||
    value === "defaults"
  );
}

export function SettingsApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = isTab(tabParam) ? tabParam : "appearance";
  const { theme, setTheme, hydrated } = useTheme();

  useEffect(() => {
    if (!tabParam) {
      router.replace("/settings?tab=appearance", { scroll: false });
    }
  }, [tabParam, router]);

  const setTab = (next: PreferencesTab | "defaults") => {
    router.replace(`/settings?tab=${next}`, { scroll: false });
  };

  const title = useMemo(
    () => TABS.find((t) => t.id === tab)?.label ?? "Settings",
    [tab],
  );

  return (
    <AppShell surface="settings" subtitle={title}>
      <div className="flex h-full min-h-0">
        <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Settings
          </p>
          <nav aria-label="Settings sections" className="flex flex-col gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={tab === item.id ? "page" : undefined}
                className={cn(
                  "rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors",
                  tab === item.id
                    ? "bg-[var(--surface-hover)] font-semibold text-[var(--text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                )}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="appScrollbar flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-1 text-xl font-semibold">{title}</h1>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Preferences apply across Home, Studio, and Editor. The radio LCD
              canvas stays dark in every theme.
            </p>

            {tab === "appearance" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-theme-preview={opt.id}
                    disabled={!hydrated}
                    onClick={() => setTheme(opt.id as ThemeId)}
                    className={cn(
                      "rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
                      theme === opt.id
                        ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <ThemePreviewSwatch id={opt.id} />
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {opt.description}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {tab === "ai" ? <AiSettingsPanel /> : null}
            {tab === "simulator" ? <SimFirmwarePanel /> : null}

            {tab === "defaults" ? (
              <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  Default radio and protocol are chosen per Studio session and
                  Editor board today. Use Studio composer settings or Editor
                  chrome to change them for the active project.
                </p>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/studio">Open Studio</Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/editor">Open Editor</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ThemePreviewSwatch({ id }: { id: ThemeId }) {
  const colors = swatch(id);
  return (
    <div className="mb-2 flex h-10 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)]">
      {colors.gradient ? (
        <>
          <span className="flex-[3]" style={{ background: colors.gradient }} />
          <span className="w-4" style={{ background: colors.accent }} />
        </>
      ) : (
        <>
          <span className="flex-1" style={{ background: colors.a }} />
          <span className="flex-1" style={{ background: colors.b }} />
          <span className="w-4" style={{ background: colors.accent }} />
        </>
      )}
    </div>
  );
}

function swatch(id: ThemeId): {
  a: string;
  b: string;
  accent: string;
  gradient?: string;
} {
  const map: Record<
    ThemeId,
    { a: string; b: string; accent: string; gradient?: string }
  > = {
    light: { a: "#eef1f4", b: "#ffffff", accent: "#0f766e" },
    dark: { a: "#0c0e13", b: "#181d28", accent: "#14b8a6" },
    midnight: { a: "#070b16", b: "#111c33", accent: "#0ea5e9" },
    slate: { a: "#1c1f26", b: "#2a303c", accent: "#94a3b8" },
    forest: { a: "#0c1410", b: "#15241c", accent: "#22c55e" },
    ocean: { a: "#e8f4f8", b: "#ffffff", accent: "#0891b2" },
    contrast: { a: "#000000", b: "#ffffff", accent: "#ffff00" },
    graphite: { a: "#eceff3", b: "#ffffff", accent: "#475569" },
    meadow: { a: "#f3f7ef", b: "#ffffff", accent: "#65a30d" },
    fog: { a: "#eef2f6", b: "#ffffff", accent: "#64748b" },
    ember: { a: "#140f0c", b: "#1f1712", accent: "#f59e0b" },
    volt: { a: "#0b0f0a", b: "#141a12", accent: "#a3e635" },
    copper: { a: "#16110e", b: "#221a15", accent: "#d97706" },
    aurora: {
      a: "#070b14",
      b: "#131c2e",
      accent: "#22d3ee",
      gradient:
        "linear-gradient(135deg, #22d3ee 0%, #34d399 45%, #e879f9 100%)",
    },
    sunset: {
      a: "#140c0e",
      b: "#271820",
      accent: "#fb7185",
      gradient:
        "linear-gradient(135deg, #fb7185 0%, #f97316 50%, #fbbf24 100%)",
    },
    prism: {
      a: "#f3f0f8",
      b: "#ffffff",
      accent: "#0d9488",
      gradient:
        "linear-gradient(135deg, #2dd4bf 0%, #38bdf8 50%, #f472b6 100%)",
    },
    flare: { a: "#120814", b: "#261430", accent: "#e879f9" },
    citrus: { a: "#121008", b: "#262010", accent: "#f59e0b" },
    candy: { a: "#0e0a16", b: "#1e1630", accent: "#f472b6" },
  };
  return map[id];
}
