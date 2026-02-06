"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import { getDocuments, Document, DocumentListResponse } from "@/lib/api";
import { formatFileSize, cn } from "@/lib/utils";

interface DocumentsListProps {
  onDocumentSelect: (documentId: number) => void;
}

export function DocumentsList({ onDocumentSelect }: DocumentsListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDocuments();
  }, [page]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await getDocuments(page, 50);
      setDocuments(data.documents);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = searchQuery
    ? documents.filter(
        (doc) =>
          doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-medium text-lg">All Documents</h2>
          <Badge variant="secondary">{total.toLocaleString()} total</Badge>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter documents on this page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Document List */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          {loading ? (
            <LoadingState message="Loading documents..." />
          ) : filteredDocuments.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onDocumentSelect(doc.id)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-start gap-3"
                >
                  <div className="p-2 bg-muted rounded flex-shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.filename}</p>
                    {doc.title && (
                      <p className="text-sm text-muted-foreground truncate">
                        {doc.title}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {doc.page_count} pages
                      </Badge>
                      {doc.file_size && (
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(doc.file_size)}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          doc.ocr_status === "completed" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {doc.ocr_status}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No documents found"
              description={
                searchQuery
                  ? "No documents match your filter"
                  : "No documents have been processed yet"
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
