"use client";

import { useState, useEffect } from "react";
import { Bookmark, FileText, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import { getBookmarks, deleteAnnotation, Annotation } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

interface BookmarksViewProps {
  onDocumentSelect: (documentId: number) => void;
}

export function BookmarksView({ onDocumentSelect }: BookmarksViewProps) {
  const [bookmarks, setBookmarks] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const data = await getBookmarks();
      setBookmarks(data.annotations);
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteAnnotation(id);
      setBookmarks(bookmarks.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Failed to remove bookmark:", error);
    }
  };

  const filteredBookmarks = searchQuery
    ? bookmarks.filter(
        (b) =>
          b.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : bookmarks;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <h2 className="font-medium text-lg">Bookmarks</h2>
          <Badge variant="secondary">{bookmarks.length} saved</Badge>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Bookmarks List */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          {loading ? (
            <LoadingState message="Loading bookmarks..." />
          ) : filteredBookmarks.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  onClick={() => onDocumentSelect(bookmark.document_id)}
                  className="px-4 py-3 hover:bg-muted transition-colors cursor-pointer flex items-start gap-3"
                >
                  <div className="p-2 bg-muted rounded flex-shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Document #{bookmark.document_id}</p>
                    {bookmark.note && (
                      <p className="text-sm text-muted-foreground truncate">
                        {bookmark.note}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bookmark.tags?.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saved {formatDate(bookmark.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={(e) => handleRemoveBookmark(bookmark.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No bookmarks yet"
              description="Bookmark documents while browsing to save them for later"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
