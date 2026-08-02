"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles,
  LayoutDashboard,
  LayoutTemplate,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

export type AppSurface =
  "home" | "studio" | "editor" | "templates" | "settings";

type NavItem = {
  id: AppSurface;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    id: "studio",
    label: "Studio",
    href: "/studio",
    icon: Sparkles,
    match: (p) => p.startsWith("/studio"),
  },
  {
    id: "editor",
    label: "Editor",
    href: "/editor",
    icon: LayoutDashboard,
    match: (p) => p.startsWith("/editor"),
  },
  {
    id: "templates",
    label: "Templates",
    href: "/templates",
    icon: LayoutTemplate,
    match: (p) => p.startsWith("/templates"),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    match: (p) => p.startsWith("/settings"),
  },
];

export interface AppShellProps {
  surface: AppSurface;
  /** Collapse app nav to icons (Editor). */
  iconRail?: boolean;
  /** Override Editor href when a project/session is open. */
  editorHref?: string | null;
  studioHref?: string | null;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared product shell: sidebar destinations + top context bar.
 * Editor uses iconRail to maximize canvas width.
 */
export function AppShell({
  surface,
  iconRail = false,
  editorHref,
  studioHref,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? "/";

  const hrefFor = (item: NavItem): string => {
    if (item.id === "editor" && editorHref) return editorHref;
    if (item.id === "studio" && studioHref) return studioHref;
    return item.href;
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]",
          iconRail ? "w-14" : "w-[220px]",
        )}
        aria-label="Workspace"
      >
        <div
          className={cn(
            "flex h-12 items-center gap-2 border-b border-[var(--border)] px-3",
            iconRail && "justify-center px-0",
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-[var(--text)] no-underline hover:text-[var(--text)]"
            aria-label="EdgeTX Dashboard Generator home"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-xs font-bold text-[var(--on-accent)]">
              ETX
            </span>
            {!iconRail ? (
              <span className="text-sm tracking-tight">Dashboards</span>
            ) : null}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon;
            const href = hrefFor(item);
            const active = item.match(pathname) || surface === item.id;
            return (
              <Link
                key={item.id}
                href={href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-sm no-underline transition-colors",
                  iconRail && "justify-center px-0",
                  active
                    ? "bg-[var(--surface-hover)] font-semibold text-[var(--text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!iconRail ? (
                  <span>{item.label}</span>
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {!iconRail ? (
          <>
            <Separator />
            <div className="p-3 text-[11px] leading-snug text-[var(--text-muted)]">
              Browse → Create → Refine → Ship
            </div>
          </>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              EdgeTX Dashboards
            </p>
            {subtitle ? (
              <div className="truncate text-xs text-[var(--text-muted)]">
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings">Settings</Link>
            </Button>
          )}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
