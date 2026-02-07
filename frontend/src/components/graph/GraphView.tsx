"use client";

import { useState, useEffect, useRef } from "react";
import {
  Network,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Users,
  ArrowLeft,
  Search,
  Building,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getEntityConnections,
  getEntities,
  GraphData,
  Entity,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface GraphViewProps {
  onDocumentSelect: (documentId: number) => void;
}

export function GraphView({ onDocumentSelect }: GraphViewProps) {
  // Internal state - completely self-contained
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [entityType, setEntityType] = useState<string>("PERSON");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);

  // Load entities on mount and when filter changes
  useEffect(() => {
    loadEntities();
  }, [entityType]);

  const loadEntities = async () => {
    setLoading(true);
    try {
      const data = await getEntities(1, 30, entityType, searchTerm || undefined);
      setEntities(data.entities);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadEntities();
  };

  const handleEntitySelect = async (entity: Entity) => {
    setSelectedEntity(entity);
    setGraphLoading(true);
    try {
      const data = await getEntityConnections(entity.id);
      setGraphData(data.graph);
    } catch (error) {
      console.error("Failed to load graph:", error);
    } finally {
      setGraphLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedEntity(null);
    setGraphData(null);
    setZoom(1);
  };

  // Canvas rendering
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    graphData.nodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const nodeRadius = 8 * node.size * zoom;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || "#3b82f6";
      ctx.fill();

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
  const handleResetZoom = () => setZoom(1);

  const entityTypeButtons = [
    { type: "PERSON", label: "People", icon: Users },
    { type: "ORG", label: "Organizations", icon: Building },
    { type: "GPE", label: "Places", icon: MapPin },
  ];

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel - Entity List */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5 text-primary" />
          <h2 className="font-medium text-lg">Graph Explorer</h2>
        </div>

        {/* Entity Type Filter */}
        <div className="flex gap-1 mb-3">
          {entityTypeButtons.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={entityType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setEntityType(type)}
              className="flex-1"
            >
              <Icon className="h-3 w-3 mr-1" />
              {label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-8 h-9"
            />
          </div>
          <Button size="sm" onClick={handleSearch}>
            Go
          </Button>
        </div>

        {/* Entity List */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full overflow-auto">
            {loading ? (
              <LoadingState message="Loading..." />
            ) : entities.length > 0 ? (
              <div className="divide-y divide-border">
                {entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => handleEntitySelect(entity)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center justify-between",
                      selectedEntity?.id === entity.id && "bg-muted"
                    )}
                  >
                    <span className="font-medium truncate text-sm">
                      {entity.name}
                    </span>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {entity.document_count}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No entities found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Graph */}
      <div className="flex-1 flex flex-col">
        {selectedEntity ? (
          <>
            {/* Graph Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="h-4 w-px bg-border" />
                <h3 className="font-medium">{selectedEntity.name}</h3>
                <Badge variant="outline">{selectedEntity.entity_type}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleResetZoom}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Graph Canvas */}
            <Card className="flex-1 overflow-hidden">
              <CardContent className="p-0 h-full">
                {graphLoading ? (
                  <LoadingState message="Loading connections..." />
                ) : graphData && graphData.nodes.length > 0 ? (
                  <canvas ref={canvasRef} className="w-full h-full" />
                ) : (
                  <EmptyState
                    title="No connections found"
                    description="This entity has no detected connections in the documents."
                  />
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            {graphData && graphData.nodes.length > 0 && (
              <Card className="mt-3">
                <CardContent className="py-2">
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
          </>
        ) : (
          /* Empty state when no entity selected */
          <Card className="flex-1 flex items-center justify-center">
            <CardContent className="text-center">
              <Network className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select an Entity</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Choose a person, organization, or place from the list to visualize
                their connections across documents.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
