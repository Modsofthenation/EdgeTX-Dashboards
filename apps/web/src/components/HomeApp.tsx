"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, LayoutTemplate, FilePlus2, Upload } from "lucide-react";
import { AppShell } from "~/components/AppShell";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { listRecentProjects, type ProjectSummary } from "~/lib/projectLibrary";
import { buildBlankEditorHref, buildProjectEditorHref } from "~/lib/editorHref";
import { buildStudioHref } from "~/lib/studioHref";
import { DEFAULT_RADIO_ID } from "@widget-gen/shared";

const DEFAULT_PROTOCOL = "betaflight";

export function HomeApp() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    setProjects(listRecentProjects());
  }, []);

  const editorHref = useMemo(
    () =>
      buildBlankEditorHref({
        protocol: DEFAULT_PROTOCOL,
        radioId: DEFAULT_RADIO_ID,
      }),
    [],
  );

  return (
    <AppShell
      surface="home"
      subtitle="Library"
      actions={
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href="/templates">Browse templates</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={buildStudioHref()}>New dashboard</Link>
          </Button>
        </>
      }
    >
      <div className="appScrollbar h-full overflow-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <section className="grid gap-4 md:grid-cols-3">
            <QuickStartCard
              icon={Sparkles}
              title="AI Studio"
              description="Describe a dashboard in plain language"
              href={buildStudioHref()}
              cta="Describe…"
              primary
            />
            <QuickStartCard
              icon={LayoutTemplate}
              title="Templates"
              description="Whoop, freestyle, RF heli, CRSF…"
              href="/templates"
              cta="Browse gallery"
            />
            <QuickStartCard
              icon={FilePlus2}
              title="Blank / Import"
              description="Empty board or paste existing Lua"
              href={editorHref}
              cta="Open editor"
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Recent projects
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href={editorHref}>
                  <Upload className="size-3.5" />
                  Import in Editor
                </Link>
              </Button>
            </div>

            {projects.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No projects yet</CardTitle>
                  <CardDescription>
                    Start from Studio, pick a template, or open a blank board in
                    the Editor.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {projects.slice(0, 12).map((project) => (
                  <Link
                    key={project.id}
                    href={buildProjectEditorHref({
                      projectId: project.id,
                      protocol: project.protocol || DEFAULT_PROTOCOL,
                      radioId: project.radioId ?? DEFAULT_RADIO_ID,
                      layoutProfileId: project.layoutProfileId,
                      sessionId: project.sessionId,
                      workspaceKey: project.workspaceKey,
                    })}
                    className="group no-underline"
                  >
                    <Card className="h-full transition-colors group-hover:border-[var(--border-strong)] group-hover:bg-[var(--surface-hover)]">
                      <div className="flex h-20 items-center justify-center border-b border-[var(--border)] bg-[var(--canvas-bg)] font-mono text-[10px] text-[var(--text-muted)]">
                        480×320
                      </div>
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline">{project.protocol}</Badge>
                          <span>{formatRelative(project.updatedAt)}</span>
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function QuickStartCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  primary,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  href: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-hover)]">
          <Icon className="size-4 text-[var(--accent)]" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button asChild variant={primary ? "default" : "secondary"} size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const hours = Math.round(delta / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
