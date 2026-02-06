"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Bookmark,
  Users,
  ScanFace,
  Network,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getDocument,
  getDocumentText,
  getDocumentPdfUrl,
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
  Document,
  Annotation,
} from "@/lib/api";
import { formatDate, formatFileSize, getEntityColor, getEntityLabel } from "@/lib/utils";

interface DocumentViewProps {
  documentId: number | null;
  onEntitySelect: (entityId: number) => void;
  onFaceSelect: (faceId: number) => void;
  onViewEntities?: () => void;
  onViewFaces?: () => void;
  onViewConnections?: () => void;
}

export function DocumentView({
  documentId,
  onEntitySelect,
  onFaceSelect,
  onViewEntities,
  onViewFaces,
  onViewConnections,
}: DocumentViewProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "pdf">("text");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
      checkBookmarkStatus(documentId);
    }
  }, [documentId]);

  const loadDocument = async (id: number) => {
    setLoading(true);
    try {
      const [docData, textData] = await Promise.all([
        getDocument(id),
        getDocumentText(id),
      ]);
      setDocument(docData);
      setText(textData.text);
    } catch (error) {
      console.error("Failed to load document:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkBookmarkStatus = async (id: number) => {
    try {
      const data = await getAnnotations(id);
      const bookmark = data.annotations.find((a) => a.bookmarked);
      if (bookmark) {
        setIsBookmarked(true);
        setBookmarkId(bookmark.id);
      } else {
        setIsBookmarked(false);
        setBookmarkId(null);
      }
    } catch (error) {
      console.error("Failed to check bookmark status:", error);
    }
  };

  const toggleBookmark = async () => {
    if (!documentId) return;

    try {
      if (isBookmarked && bookmarkId) {
        await deleteAnnotation(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
      } else {
        const annotation = await createAnnotation({
          document_id: documentId,
          bookmarked: true,
        });
        setIsBookmarked(true);
        setBookmarkId(annotation.id);
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  };

  if (!documentId) {
    return (
      <EmptyState
        title="No document selected"
        description="Select a document from search results or the documents list to view it"
      />
    );
  }

  if (loading) {
    return <LoadingState message="Loading document..." />;
  }

  if (!document) {
    return (
      <EmptyState
        title="Document not found"
        description="The requested document could not be loaded"
      />
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document Header */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{document.filename}</CardTitle>
                {document.title && (
                  <p className="text-muted-foreground mt-1">{document.title}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant={isBookmarked ? "default" : "outline"}
                  size="icon"
                  title={isBookmarked ? "Remove Bookmark" : "Bookmark"}
                  onClick={toggleBookmark}
                >
                  <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
                </Button>
                <a
                  href={getDocumentPdfUrl(document.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="icon" title="Download PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{document.page_count} pages</Badge>
              {document.file_size && (
                <Badge variant="secondary">
                  {formatFileSize(document.file_size)}
                </Badge>
              )}
              {document.has_images && (
                <Badge variant="secondary">{document.image_count} images</Badge>
              )}
              {document.earliest_date && (
                <Badge variant="outline">
                  {formatDate(document.earliest_date)}
                </Badge>
              )}
            </div>
            {document.source_url && (
              <a
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1"
              >
                View on DOJ.gov <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "text" ? "default" : "outline"}
            onClick={() => setActiveTab("text")}
          >
            Extracted Text
          </Button>
          <Button
            variant={activeTab === "pdf" ? "default" : "outline"}
            onClick={() => setActiveTab("pdf")}
          >
            PDF View
          </Button>
        </div>

        {/* Content */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            {activeTab === "text" ? (
              <div className="p-4 h-full overflow-auto">
                {text ? (
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {text}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">
                    No text extracted from this document
                  </p>
                )}
              </div>
            ) : (
              <iframe
                src={getDocumentPdfUrl(document.id)}
                className="w-full h-full border-0"
                title={document.filename}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 space-y-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onViewEntities}
            >
              <Users className="h-4 w-4 mr-2" />
              View Entities
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onViewFaces}
            >
              <ScanFace className="h-4 w-4 mr-2" />
              View Faces
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onViewConnections}
            >
              <Network className="h-4 w-4 mr-2" />
              View Connections
            </Button>
          </CardContent>
        </Card>

        {/* Processing Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OCR</span>
                <StatusBadge status={document.ocr_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entities</span>
                <StatusBadge status={document.entity_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faces</span>
                <StatusBadge status={document.face_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Indexed</span>
                <StatusBadge status={document.indexed_status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    completed: "default",
    indexed: "default",
    pending: "secondary",
    failed: "outline",
  };
  return (
    <Badge variant={variants[status] || "secondary"} className="text-xs">
      {status}
    </Badge>
  );
}
