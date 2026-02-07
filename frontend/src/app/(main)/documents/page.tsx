"use client";

import { useRouter } from "next/navigation";
import { DocumentsList } from "@/components/document/DocumentsList";

export default function DocumentsPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  return <DocumentsList onDocumentSelect={handleDocumentSelect} />;
}
