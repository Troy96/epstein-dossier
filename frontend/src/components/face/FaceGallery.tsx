"use client";

import { useState, useEffect } from "react";
import { ScanFace, Search, Grid, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getFaces,
  getFaceClusters,
  findSimilarFaces,
  Face,
  FaceCluster,
  FaceSimilarityResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface FaceGalleryProps {
  selectedFaceId: number | null;
  onDocumentSelect: (documentId: number) => void;
  onFaceSelect: (faceId: number) => void;
}

type ViewMode = "all" | "clusters";

export function FaceGallery({
  selectedFaceId,
  onDocumentSelect,
  onFaceSelect,
}: FaceGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [faces, setFaces] = useState<Face[]>([]);
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [selectedFace, setSelectedFace] = useState<Face | null>(null);
  const [similarFaces, setSimilarFaces] = useState<FaceSimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (viewMode === "all") {
      loadFaces();
    } else {
      loadClusters();
    }
  }, [viewMode, page]);

  useEffect(() => {
    if (selectedFaceId) {
      loadFaceDetails(selectedFaceId);
    }
  }, [selectedFaceId]);

  const loadFaces = async () => {
    setLoading(true);
    try {
      const data = await getFaces(page, 50);
      setFaces(data.faces);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Failed to load faces:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    setLoading(true);
    try {
      const data = await getFaceClusters(2);
      setClusters(data.clusters);
    } catch (error) {
      console.error("Failed to load clusters:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFaceDetails = async (faceId: number) => {
    try {
      const similarData = await findSimilarFaces(faceId, 10);
      setSimilarFaces(similarData.results);

      // Find the face in our list
      const face = faces.find(f => f.id === faceId);
      if (face) {
        setSelectedFace(face);
      }
    } catch (error) {
      console.error("Failed to load face details:", error);
    }
  };

  const handleFaceClick = (face: Face) => {
    setSelectedFace(face);
    onFaceSelect(face.id);
    loadFaceDetails(face.id);
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Face Grid */}
      <div className="flex-1 flex flex-col">
        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            onClick={() => setViewMode("all")}
          >
            <Grid className="h-4 w-4 mr-2" />
            All Faces
          </Button>
          <Button
            variant={viewMode === "clusters" ? "default" : "outline"}
            onClick={() => setViewMode("clusters")}
          >
            <Layers className="h-4 w-4 mr-2" />
            Clusters (Same Person)
          </Button>
        </div>

        {/* Content */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-4 h-full overflow-auto">
            {loading ? (
              <LoadingState message="Loading faces..." />
            ) : viewMode === "all" ? (
              faces.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {faces.map((face) => (
                      <FaceCard
                        key={face.id}
                        face={face}
                        selected={selectedFace?.id === face.id}
                        onClick={() => handleFaceClick(face)}
                      />
                    ))}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <ScanFace className="h-16 w-16 text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Face Detection</h2>
                  <p className="text-muted-foreground text-center max-w-lg mb-6">
                    This feature detects and extracts faces from document images,
                    allowing you to search for similar faces across all documents.
                  </p>

                  <Card className="max-w-md w-full">
                    <CardHeader>
                      <CardTitle className="text-sm text-amber-500">Setup Required</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <p className="text-muted-foreground">
                        Face detection requires the <code className="bg-muted px-1 rounded">face_recognition</code> library
                        which depends on dlib and CMake.
                      </p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs space-y-1">
                        <p># Install dependencies</p>
                        <p>brew install cmake</p>
                        <p>pip install face-recognition</p>
                        <p></p>
                        <p># Run face detection</p>
                        <p>cd backend</p>
                        <p>python -m app.cli faces</p>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Note: dlib compilation can take several minutes.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )
            ) : clusters.length > 0 ? (
              <div className="space-y-6">
                {clusters.map((cluster) => (
                  <ClusterCard
                    key={cluster.id}
                    cluster={cluster}
                    onFaceClick={handleFaceClick}
                    onDocumentClick={onDocumentSelect}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No face clusters found"
                description="Face clustering groups similar faces together. Run face detection first, then clustering will automatically group faces of the same person."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Face Details Sidebar */}
      <div className="w-80 flex-shrink-0">
        {selectedFace ? (
          <div className="space-y-4">
            {/* Selected Face */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selected Face</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-4">
                  {selectedFace.face_crop_path ? (
                    <img
                      src={`/api${selectedFace.face_crop_path}`}
                      alt="Face"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ScanFace className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Document</span>
                    <button
                      onClick={() => onDocumentSelect(selectedFace.document_id)}
                      className="text-primary hover:underline truncate max-w-[150px]"
                    >
                      {selectedFace.document_filename || `Doc #${selectedFace.document_id}`}
                    </button>
                  </div>
                  {selectedFace.page_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Page</span>
                      <span>{selectedFace.page_number}</span>
                    </div>
                  )}
                  {selectedFace.cluster_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cluster</span>
                      <Badge variant="secondary">#{selectedFace.cluster_id}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Similar Faces */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Similar Faces</CardTitle>
              </CardHeader>
              <CardContent>
                {similarFaces.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {similarFaces.map((result) => (
                      <button
                        key={result.face.id}
                        onClick={() => handleFaceClick(result.face)}
                        className="relative aspect-square rounded overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
                      >
                        {result.face.face_crop_path ? (
                          <img
                            src={`/api${result.face.face_crop_path}`}
                            alt="Similar face"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ScanFace className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-0.5">
                          {Math.round(result.similarity * 100)}%
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No similar faces found</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                title="Select a face"
                description="Click on a face to view details and find similar faces"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FaceCard({
  face,
  selected,
  onClick,
}: {
  face: Face;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "aspect-square rounded-lg overflow-hidden bg-muted transition-all",
        selected && "ring-2 ring-primary"
      )}
    >
      {face.face_crop_path ? (
        <img
          src={`/api${face.face_crop_path}`}
          alt="Face"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ScanFace className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

function ClusterCard({
  cluster,
  onFaceClick,
  onDocumentClick,
}: {
  cluster: FaceCluster;
  onFaceClick: (face: Face) => void;
  onDocumentClick: (documentId: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {cluster.name || `Person #${cluster.id}`}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{cluster.face_count} faces</Badge>
            <Badge variant="outline">{cluster.document_count} docs</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {cluster.sample_faces.map((face) => (
            <button
              key={face.id}
              onClick={() => onFaceClick(face)}
              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
            >
              {face.face_crop_path ? (
                <img
                  src={`/api${face.face_crop_path}`}
                  alt="Face"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ScanFace className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
