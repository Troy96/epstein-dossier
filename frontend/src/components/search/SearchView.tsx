"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import { search, SearchResponse, SearchHit, getDocumentStats } from "@/lib/api";
import { debounce, truncateText } from "@/lib/utils";

interface SearchViewProps {
  onDocumentSelect: (documentId: number) => void;
  onEntitySelect: (entityId: number) => void;
}

export function SearchView({ onDocumentSelect, onEntitySelect }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    getDocumentStats().then((stats) => setDocCount(stats.total)).catch(() => {});
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, pageNum: number) => {
      if (!searchQuery.trim()) {
        setResults(null);
        return;
      }

      setLoading(true);
      try {
        const data = await search(searchQuery, pageNum);
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const debouncedSearch = useCallback(
    debounce((q: string) => {
      setPage(1);
      performSearch(q, 1);
    }, 300),
    [performSearch]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    performSearch(query, newPage);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search documents... (e.g., names, places, dates)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-14 text-lg"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Search through {docCount ? docCount.toLocaleString() : "..."} DOJ documents by content, not just titles
        </p>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingState message="Searching..." />
      ) : results ? (
        <div>
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground">
              Found <span className="text-foreground font-medium">{results.total}</span> results
              in {results.processing_time_ms}ms
            </p>
          </div>

          {/* Results List */}
          {results.hits.length > 0 ? (
            <div className="space-y-3">
              {results.hits.map((hit) => (
                <SearchResultCard
                  key={hit.id}
                  hit={hit}
                  onClick={() => onDocumentSelect(hit.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No results found"
              description="Try different keywords or check your spelling"
            />
          )}

          {/* Pagination */}
          {results.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {results.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === results.total_pages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Search the Epstein Files</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enter a search term to find documents. Unlike the DOJ search,
            this searches the actual content of documents, not just titles.
          </p>
        </div>
      )}
    </div>
  );
}

function SearchResultCard({
  hit,
  onClick,
}: {
  hit: SearchHit;
  onClick: () => void;
}) {
  const highlight = hit.highlights?.extracted_text?.[0] || "";

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-muted rounded-lg">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{hit.filename}</h3>
            {hit.title && (
              <p className="text-sm text-muted-foreground truncate">{hit.title}</p>
            )}
            {highlight && (
              <p
                className="text-sm mt-2 text-muted-foreground line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: truncateText(highlight, 200),
                }}
              />
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{hit.page_count} pages</Badge>
              {hit.score && (
                <span className="text-xs text-muted-foreground">
                  Score: {hit.score.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
