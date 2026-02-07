"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaceGallery } from "@/components/face/FaceGallery";
import { LoadingState } from "@/components/ui/Spinner";

function FacesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFaceId = searchParams.get("id")
    ? parseInt(searchParams.get("id") as string, 10)
    : null;

  const handleDocumentSelect = (documentId: number) => {
    router.push(`/document/${documentId}`);
  };

  const handleFaceSelect = (faceId: number) => {
    router.push(`/faces?id=${faceId}`);
  };

  return (
    <FaceGallery
      selectedFaceId={selectedFaceId}
      onDocumentSelect={handleDocumentSelect}
      onFaceSelect={handleFaceSelect}
    />
  );
}

export default function FacesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <FacesContent />
    </Suspense>
  );
}
