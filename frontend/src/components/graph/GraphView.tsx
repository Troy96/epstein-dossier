"use client";

import { useState, useEffect, useRef } from "react";
import { Network, ZoomIn, ZoomOut, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getDocumentConnections,
  getEntityConnections,
  getEntities,
  GraphData,
  Entity,
} from "@/lib/api";

interface GraphViewProps {
  documentId: number | null;
  entityId: number | null;
  onDocumentSelect: (documentId: number) => void;
  onEntitySelect: (entityId: number) => void;
}

export function GraphView({
  documentId,
  entityId,
  onDocumentSelect,
  onEntitySelect,
}: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [topEntities, setTopEntities] = useState<Entity[]>([]);
  const [selectedEntityForGraph, setSelectedEntityForGraph] = useState<number | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocumentGraph(documentId);
    } else if (entityId) {
      loadEntityGraph(entityId);
    } else {
      // Load top entities for exploration
      loadTopEntities();
    }
  }, [documentId, entityId]);

  const loadTopEntities = async () => {
    try {
      const data = await getEntities(1, 10, "PERSON");
      setTopEntities(data.entities);
    } catch (error) {
      console.error("Failed to load top entities:", error);
    }
  };

  const handleEntityClick = (entity: Entity) => {
    setSelectedEntityForGraph(entity.id);
    loadEntityGraph(entity.id);
  };

  const loadDocumentGraph = async (id: number) => {
    setLoading(true);
    try {
      const data = await getDocumentConnections(id);
      setGraphData(data.graph);
      setTitle(`Connections for: ${data.document_filename}`);
    } catch (error) {
      console.error("Failed to load document graph:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntityGraph = async (id: number) => {
    setLoading(true);
    try {
      const data = await getEntityConnections(id);
      setGraphData(data.graph);
      setTitle(`Connections for: ${data.entity_name}`);
    } catch (error) {
      console.error("Failed to load entity graph:", error);
    } finally {
      setLoading(false);
    }
  };

  // Simple canvas-based graph rendering
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear canvas
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate node positions in a circle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35 * zoom;

    const nodePositions: Record<string, { x: number; y: number }> = {};
    graphData.nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / graphData.nodes.length;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Draw edges
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;
    graphData.edges.forEach((edge) => {
      const source = nodePositions[edge.source];
      const target = nodePositions[edge.target];
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    graphData.nodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const nodeRadius = 8 * node.size * zoom;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || "#3b82f6";
      ctx.fill();

      // Node label
      ctx.fillStyle = "#e5e5e5";
      ctx.font = `${10 * zoom}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        node.label.length > 15 ? node.label.slice(0, 15) + "..." : node.label,
        pos.x,
        pos.y + nodeRadius + 12 * zoom
      );
    });
  }, [graphData, zoom]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleReset = () => setZoom(1);

  if (!documentId && !entityId && !selectedEntityForGraph) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5 text-primary" />
          <h2 className="font-medium text-lg">Graph Visualization</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                The graph shows connections between documents and entities (people,
                organizations, locations) mentioned in them.
              </p>
              <p className="font-medium text-foreground mt-4">To explore:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click on a person below to see their connections</li>
                <li>Or search for a document and click &quot;View Connections&quot;</li>
                <li>Or go to Entities and select any entity</li>
              </ol>
            </CardContent>
          </Card>

          {/* Top Entities to Explore */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top People to Explore
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topEntities.length > 0 ? (
                <div className="space-y-2">
                  {topEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => handleEntityClick(entity)}
                      className="w-full p-2 rounded-lg bg-muted hover:bg-muted/80 text-left transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium truncate">{entity.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {entity.document_count} docs
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Loading entities...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h2 className="font-medium">{title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Graph Canvas */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full relative">
          {loading ? (
            <LoadingState message="Loading graph..." />
          ) : graphData && graphData.nodes.length > 0 ? (
            <canvas ref={canvasRef} className="w-full h-full" />
          ) : (
            <EmptyState
              title="No connections found"
              description="This document or entity has no detected connections. Connections are based on shared entities. Neo4j can be enabled for richer relationship data."
            />
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {graphData && graphData.nodes.length > 0 && (
        <Card className="mt-4">
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                <span>Document</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <span>Person</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                <span>Organization</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <span>Location</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
