"use client";

import { useRouter } from "next/navigation";
import { TimelineView } from "@/components/timeline/TimelineView";

export default function TimelinePage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  return <TimelineView onDocumentSelect={handleDocumentSelect} />;
}
