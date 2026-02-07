"use client";

import { useRouter } from "next/navigation";
import { GraphView } from "@/components/graph/GraphView";

export default function GraphPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  return <GraphView onDocumentSelect={handleDocumentSelect} />;
}
