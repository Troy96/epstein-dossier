"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  Flag,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getImageAnalyses,
  getImageAnalysisStats,
  ImageAnalysisItem,
  ImageAnalysisStats,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "document",
  "photo",
  "handwritten",
  "map",
  "flight_log",
  "receipt",
  "evidence",
  "explicit",
  "correspondence",
  "other",
];

const CATEGORY_COLORS: Record<string, string> = {
  document: "bg-blue-500/20 text-blue-400",
  photo: "bg-green-500/20 text-green-400",
  handwritten: "bg-yellow-500/20 text-yellow-400",
  map: "bg-cyan-500/20 text-cyan-400",
  flight_log: "bg-orange-500/20 text-orange-400",
  receipt: "bg-purple-500/20 text-purple-400",
  evidence: "bg-red-500/20 text-red-400",
  explicit: "bg-red-700/20 text-red-500",
  correspondence: "bg-indigo-500/20 text-indigo-400",
  other: "bg-gray-500/20 text-gray-400",
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 0.8
      ? "bg-red-500/20 text-red-400"
      : score >= 0.5
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-gray-500/20 text-gray-400";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        color
      )}
    >
      {(score * 100).toFixed(0)}%
    </span>
  );
}

interface ImageAnalysisViewProps {
  onDocumentSelect: (documentId: number) => void;
}

export function ImageAnalysisView({ onDocumentSelect }: ImageAnalysisViewProps) {
  const [analyses, setAnalyses] = useState<ImageAnalysisItem[]>([]);
  const [stats, setStats] = useState<ImageAnalysisStats | null>(null);
  const [selected, setSelected] = useState<ImageAnalysisItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [flaggedFilter, setFlaggedFilter] = useState<boolean | undefined>();
  const [minScore, setMinScore] = useState<number | undefined>();

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [page, categoryFilter, flaggedFilter, minScore]);

  const loadStats = async () => {
    try {
      const data = await getImageAnalysisStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const data = await getImageAnalyses(
        page,
        24,
        categoryFilter,
        flaggedFilter,
        minScore,
        "interest_score",
        "desc"
      );
      setAnalyses(data.analyses);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to load analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setCategoryFilter(undefined);
    setFlaggedFilter(undefined);
    setMinScore(undefined);
    setPage(1);
  };

  const hasFilters = categoryFilter || flaggedFilter !== undefined || minScore !== undefined;

  return (
    <div className="flex gap-4 h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stats Bar */}
        {stats && (
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Analyzed:</span>
              <span className="font-medium">{stats.total_analyzed.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm">
              <Flag className="h-4 w-4 text-red-400" />
              <span className="text-muted-foreground">Flagged:</span>
              <span className="font-medium text-red-400">{stats.total_flagged.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">Avg Score:</span>
              <ScoreBadge score={stats.avg_interest_score} />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Category filter */}
          <select
            value={categoryFilter || ""}
            onChange={(e) => {
              setCategoryFilter(e.target.value || undefined);
              setPage(1);
            }}
            className="bg-muted border border-border rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace("_", " ")}
              </option>
            ))}
          </select>

          {/* Flagged filter */}
          <Button
            variant={flaggedFilter === true ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFlaggedFilter(flaggedFilter === true ? undefined : true);
              setPage(1);
            }}
          >
            <Flag className="h-3 w-3 mr-1" />
            Flagged
          </Button>

          {/* Score threshold */}
          <select
            value={minScore !== undefined ? minScore.toString() : ""}
            onChange={(e) => {
              setMinScore(e.target.value ? parseFloat(e.target.value) : undefined);
              setPage(1);
            }}
            className="bg-muted border border-border rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Any score</option>
            <option value="0.3">Score 30%+</option>
            <option value="0.5">Score 50%+</option>
            <option value="0.7">Score 70%+</option>
            <option value="0.9">Score 90%+</option>
          </select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          <span className="text-sm text-muted-foreground ml-auto">
            {total.toLocaleString()} results
          </span>
        </div>

        {/* Image Grid */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-4 h-full overflow-auto">
            {loading ? (
              <LoadingState message="Loading image analyses..." />
            ) : analyses.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {analyses.map((item) => (
                    <ImageCard
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      onClick={() => setSelected(item)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
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
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <Eye className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Image Analysis</h2>
                <p className="text-muted-foreground text-center max-w-lg mb-6">
                  AI-powered scanning of document images to identify evidence,
                  handwritten notes, flight logs, photos, and other notable content.
                </p>
                <Card className="max-w-md w-full">
                  <CardHeader>
                    <CardTitle className="text-sm text-amber-500">
                      Setup Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <p className="text-muted-foreground">
                      Set your <code className="bg-muted px-1 rounded">ANTHROPIC_API_KEY</code> in{" "}
                      <code className="bg-muted px-1 rounded">.env</code> and run:
                    </p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-xs space-y-1">
                      <p>cd backend</p>
                      <p>python -m app.cli analyze-images</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Sidebar */}
      <div className="w-80 flex-shrink-0">
        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Image Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Image preview */}
                <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                  <img
                    src={`/api${selected.image_path}`}
                    alt={selected.description || "Document image"}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Description */}
                {selected.description && (
                  <p className="text-sm mb-4">{selected.description}</p>
                )}

                {/* Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Category</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        CATEGORY_COLORS[selected.category || "other"]
                      )}
                    >
                      {(selected.category || "other").replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Interest</span>
                    <ScoreBadge score={selected.interest_score} />
                  </div>
                  {selected.flagged && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Flagged</span>
                      <Badge className="bg-red-500/20 text-red-400">Flagged</Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Document</span>
                    <button
                      onClick={() => onDocumentSelect(selected.document_id)}
                      className="text-primary hover:underline truncate max-w-[150px] text-right"
                    >
                      {selected.document_filename || `Doc #${selected.document_id}`}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Flag Reason */}
            {selected.flag_reason && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-400">
                    <Flag className="h-4 w-4 inline mr-1" />
                    Flag Reason
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selected.flag_reason}</p>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {selected.tags && selected.tags.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Source Document Link */}
            <Card>
              <CardContent className="py-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onDocumentSelect(selected.document_id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Source Document
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                title="Select an image"
                description="Click on an image to view AI analysis details"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ImageCard({
  item,
  selected,
  onClick,
}: {
  item: ImageAnalysisItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden bg-muted transition-all text-left",
        selected && "ring-2 ring-primary"
      )}
    >
      {/* Image */}
      <div className="aspect-square">
        <img
          src={`/api${item.image_path}`}
          alt={item.description || "Document image"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Overlay badges */}
      <div className="absolute top-1 left-1 flex gap-1">
        {item.flagged && (
          <span className="bg-red-600/90 text-white rounded-full p-1">
            <Flag className="h-3 w-3" />
          </span>
        )}
      </div>

      <div className="absolute top-1 right-1">
        <ScoreBadge score={item.interest_score} />
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[10px] font-medium rounded px-1",
              CATEGORY_COLORS[item.category || "other"]
            )}
          >
            {(item.category || "other").replace("_", " ")}
          </span>
        </div>
        {item.description && (
          <p className="text-[10px] text-gray-300 truncate mt-0.5">
            {item.description}
          </p>
        )}
      </div>
    </button>
  );
}
