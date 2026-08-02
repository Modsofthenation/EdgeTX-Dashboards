"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HomeApp } from "~/components/HomeApp";
import { buildStudioHref } from "~/lib/studioHref";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId");

  useEffect(() => {
    if (chatId) {
      router.replace(buildStudioHref({ chatId }));
    }
  }, [chatId, router]);

  if (chatId) return null;
  return <HomeApp />;
}
