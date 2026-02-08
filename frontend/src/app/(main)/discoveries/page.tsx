"use client";

import { useRouter } from "next/navigation";
import { ImageAnalysisView } from "@/components/image-analysis/ImageAnalysisView";

export default function DiscoveriesPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  return <ImageAnalysisView onDocumentSelect={handleDocumentSelect} />;
}
