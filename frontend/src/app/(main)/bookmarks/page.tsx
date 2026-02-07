"use client";

import { useRouter } from "next/navigation";
import { BookmarksView } from "@/components/bookmarks/BookmarksView";

export default function BookmarksPage() {
  const router = useRouter();

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  return <BookmarksView onDocumentSelect={handleDocumentSelect} />;
}
