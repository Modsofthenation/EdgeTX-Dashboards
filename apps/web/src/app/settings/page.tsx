import { Suspense } from "react";
import { SettingsApp } from "~/components/SettingsApp";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsApp />
    </Suspense>
  );
}
