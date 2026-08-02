"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "~/components/AppShell";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  TEMPLATE_GALLERY,
  templatePreviewSrc,
  buildTemplateEditorHref,
  type TemplateGalleryItem,
} from "~/lib/templateGallery";
import { buildStudioHref } from "~/lib/studioHref";
import { DEFAULT_RADIO_ID } from "@widget-gen/shared";

type FilterId = "all" | "betaflight" | "rotorflight" | "generic-crsf";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "betaflight", label: "Betaflight" },
  { id: "rotorflight", label: "Rotorflight" },
  { id: "generic-crsf", label: "CRSF" },
];

export function TemplatesApp() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId");
  const [filter, setFilter] = useState<FilterId>("all");

  const items = useMemo(() => {
    if (filter === "all") return TEMPLATE_GALLERY;
    return TEMPLATE_GALLERY.filter((t) => t.protocol === filter);
  }, [filter]);

  return (
    <AppShell
      surface="templates"
      subtitle="Gallery"
      studioHref={buildStudioHref({ chatId })}
      actions={
        <Button asChild size="sm">
          <Link href={buildStudioHref({ chatId })}>Open Studio</Link>
        </Button>
      }
    >
      <div className="appScrollbar h-full overflow-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by protocol"
          >
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={filter === f.id ? "default" : "secondary"}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <TemplateCard key={item.id} item={item} chatId={chatId} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TemplateCard({
  item,
  chatId,
}: {
  item: TemplateGalleryItem;
  chatId: string | null;
}) {
  const editorHref = buildTemplateEditorHref({
    templateId: item.id,
    protocol: item.protocol,
    radioId: DEFAULT_RADIO_ID,
    chatId,
  });
  const studioHref = buildStudioHref({ chatId });

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--canvas-bg)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={templatePreviewSrc(item.id)}
          alt=""
          className="mx-auto h-28 w-auto object-contain"
        />
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-sm">{item.title}</CardTitle>
        <CardDescription className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.protocol}</Badge>
          {item.variant ? (
            <Badge variant="secondary">{item.variant}</Badge>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-2 text-xs text-[var(--text-muted)]">
        {item.prompt}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 p-4">
        <Button asChild size="sm">
          <Link href={editorHref}>Open in Editor</Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={studioHref}>Generate with AI</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
