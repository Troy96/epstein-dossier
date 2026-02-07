"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntityExplorer } from "@/components/entity/EntityExplorer";
import { LoadingState } from "@/components/ui/Spinner";

function EntitiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEntityId = searchParams.get("id")
    ? parseInt(searchParams.get("id") as string, 10)
    : null;

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  const handleEntitySelect = (entityId: number) => {
    router.push(`/entities?id=${entityId}`);
  };

  return (
    <EntityExplorer
      selectedEntityId={selectedEntityId}
      onDocumentSelect={handleDocumentSelect}
      onEntitySelect={handleEntitySelect}
    />
  );
}

export default function EntitiesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <EntitiesContent />
    </Suspense>
  );
}
