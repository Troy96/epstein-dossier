"use client";

import { useRouter, useParams } from "next/navigation";
import { DocumentView } from "@/components/document/DocumentView";

export default function DocumentPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id ? parseInt(params.id as string, 10) : null;

  const handleEntitySelect = (entityId: number) => {
    router.push(`/entities?id=${entityId}`);
  };

  const handleFaceSelect = (faceId: number) => {
    router.push(`/faces?id=${faceId}`);
  };

  const handleViewEntities = () => {
    router.push("/entities");
  };

  const handleViewFaces = () => {
    router.push("/faces");
  };

  const handleViewConnections = () => {
    router.push("/graph");
  };

  return (
    <DocumentView
      documentId={documentId}
      onEntitySelect={handleEntitySelect}
      onFaceSelect={handleFaceSelect}
      onViewEntities={handleViewEntities}
      onViewFaces={handleViewFaces}
      onViewConnections={handleViewConnections}
    />
  );
}
