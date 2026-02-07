"use client";

import { useRouter } from "next/navigation";
import { SearchView } from "@/components/search/SearchView";

export default function SearchPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  const handleEntitySelect = (entityId: number) => {
    router.push(`/entities?id=${entityId}`);
  };

  return (
    <SearchView
      onDocumentSelect={handleDocumentSelect}
      onEntitySelect={handleEntitySelect}
    />
  );
}
