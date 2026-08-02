import { Suspense } from "react";
import { TemplatesApp } from "~/components/TemplatesApp";

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesApp />
    </Suspense>
  );
}
