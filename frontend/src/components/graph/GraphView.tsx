"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  ArrowLeft,
  Search,
  Building,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  X,
  Download,
  FileText,
  Circle,
  GitBranch,
  Grip,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getEntityConnections,
  getEntities,
  GraphData,
  GraphNode,
  Entity,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface GraphViewProps {
  onDocumentSelect: (documentId: number) => void;
}

type LayoutType = "circular" | "force" | "hierarchical";
type NodePosition = { x: number; y: number; vx?: number; vy?: number };

export function GraphView({ onDocumentSelect }: GraphViewProps) {
  // Internal state
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [entityType, setEntityType] = useState<string>("PERSON");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntities, setTotalEntities] = useState(0);
  const [sortBy, setSortBy] = useState<"document_count" | "name" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Graph state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<LayoutType>("circular");
  const [showDocuments, setShowDocuments] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const nodePositionsRef = useRef<Record<string, NodePosition>>({});
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  // Load entities on mount and when filter/page/sort changes
  useEffect(() => {
    loadEntities();
  }, [entityType, page, sortBy, sortDir]);

  const loadEntities = async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const data = await getEntities(currentPage, 50, entityType, searchTerm || undefined, sortBy, sortDir);
      setEntities(data.entities);
      setTotalPages(data.total_pages);
      setTotalEntities(data.total);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortToggle = (field: "document_count" | "name") => {
    if (sortBy === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  const handleClearSort = () => {
    setSortBy(null);
    setSortDir("desc");
    setPage(1);
  };

  const handleSearch = () => {
    loadEntities(true);
  };

  const handleEntitySelect = async (entity: Entity) => {
    setSelectedEntity(entity);
    setGraphLoading(true);
    try {
      const data = await getEntityConnections(entity.id);
      setGraphData(data.graph);
      // Reset graph state
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      nodePositionsRef.current = {};
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
    setPanOffset({ x: 0, y: 0 });
    nodePositionsRef.current = {};
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Filter nodes based on visibility settings
  const getFilteredData = useCallback(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const filteredNodes = graphData.nodes.filter(node => {
      if (node.type === "document") return showDocuments;
      return showEntities;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graphData.edges.filter(
      edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graphData, showDocuments, showEntities]);

  // Calculate node positions based on layout
  const calculatePositions = useCallback((canvas: HTMLCanvasElement, nodes: GraphNode[]) => {
    const centerX = canvas.width / 2 + panOffset.x;
    const centerY = canvas.height / 2 + panOffset.y;
    const radius = Math.min(canvas.width, canvas.height) * 0.35 * zoom;

    const positions: Record<string, NodePosition> = {};

    if (layout === "circular") {
      nodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    } else if (layout === "hierarchical") {
      // Group by type
      const documents = nodes.filter(n => n.type === "document");
      const entities = nodes.filter(n => n.type !== "document");
      const centerNode = nodes.find(n => n.id.startsWith("entity_") && n.size >= 2);

      // Center node at top
      if (centerNode) {
        positions[centerNode.id] = { x: centerX, y: centerY - radius * 0.8 };
      }

      // Documents in middle row
      documents.forEach((node, index) => {
        const spacing = (canvas.width - 100) / (documents.length + 1);
        positions[node.id] = {
          x: 50 + spacing * (index + 1) + panOffset.x,
          y: centerY + panOffset.y,
        };
      });

      // Other entities at bottom
      const otherEntities = entities.filter(n => n !== centerNode);
      otherEntities.forEach((node, index) => {
        const spacing = (canvas.width - 100) / (otherEntities.length + 1);
        positions[node.id] = {
          x: 50 + spacing * (index + 1) + panOffset.x,
          y: centerY + radius * 0.8 + panOffset.y,
        };
      });
    } else if (layout === "force") {
      // Use existing positions or initialize randomly
      nodes.forEach((node) => {
        if (!nodePositionsRef.current[node.id]) {
          positions[node.id] = {
            x: centerX + (Math.random() - 0.5) * radius * 2,
            y: centerY + (Math.random() - 0.5) * radius * 2,
            vx: 0,
            vy: 0,
          };
        } else {
          positions[node.id] = { ...nodePositionsRef.current[node.id] };
        }
      });
    }

    return positions;
  }, [layout, zoom, panOffset]);

  // Force-directed layout simulation
  const runForceSimulation = useCallback((nodes: GraphNode[], edges: { source: string; target: string }[], positions: Record<string, NodePosition>) => {
    const alpha = 0.1;
    const repulsion = 5000;
    const attraction = 0.01;
    const damping = 0.9;
    const canvas = canvasRef.current;
    if (!canvas) return positions;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Apply forces
    nodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;

      let fx = 0, fy = 0;

      // Repulsion from other nodes
      nodes.forEach((other) => {
        if (other.id === node.id) return;
        const otherPos = positions[other.id];
        if (!otherPos) return;

        const dx = pos.x - otherPos.x;
        const dy = pos.y - otherPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      });

      // Attraction along edges
      edges.forEach((edge) => {
        let otherId: string | null = null;
        if (edge.source === node.id) otherId = edge.target;
        else if (edge.target === node.id) otherId = edge.source;
        if (!otherId) return;

        const otherPos = positions[otherId];
        if (!otherPos) return;

        const dx = otherPos.x - pos.x;
        const dy = otherPos.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        fx += dx * attraction;
        fy += dy * attraction;
      });

      // Center gravity
      fx += (centerX - pos.x) * 0.001;
      fy += (centerY - pos.y) * 0.001;

      // Update velocity and position
      pos.vx = (pos.vx || 0) * damping + fx * alpha;
      pos.vy = (pos.vy || 0) * damping + fy * alpha;
      pos.x += pos.vx || 0;
      pos.y += pos.vy || 0;

      // Keep in bounds
      pos.x = Math.max(50, Math.min(canvas.width - 50, pos.x));
      pos.y = Math.max(50, Math.min(canvas.height - 50, pos.y));
    });

    return positions;
  }, []);

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

    const { nodes, edges } = getFilteredData();
    if (nodes.length === 0) return;

    let positions = calculatePositions(canvas, nodes);

    const render = () => {
      if (layout === "force") {
        positions = runForceSimulation(nodes, edges, positions);
        nodePositionsRef.current = positions;
      }

      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 1;
      edges.forEach((edge) => {
        const source = positions[edge.source];
        const target = positions[edge.target];
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        const pos = positions[node.id];
        if (!pos) return;

        const nodeRadius = 8 * node.size * zoom;
        const isHovered = hoveredNode?.id === node.id;

        // Glow effect for hovered node
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeRadius + 4, 0, 2 * Math.PI);
          ctx.fillStyle = (node.color || "#3b82f6") + "40";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color || "#3b82f6";
        ctx.fill();

        // Border for hovered node
        if (isHovered) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.fillStyle = "#e5e5e5";
        ctx.font = `${10 * zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          node.label.length > 15 ? node.label.slice(0, 15) + "..." : node.label,
          pos.x,
          pos.y + nodeRadius + 12 * zoom
        );
      });

      if (layout === "force") {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    render();

    // Store positions for hit detection
    nodePositionsRef.current = positions;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [graphData, zoom, layout, showDocuments, showEntities, hoveredNode, panOffset, getFilteredData, calculatePositions, runForceSimulation]);

  // Mouse event handlers
  const getNodeAtPosition = useCallback((x: number, y: number): GraphNode | null => {
    if (!graphData) return null;
    const { nodes } = getFilteredData();

    for (const node of nodes) {
      const pos = nodePositionsRef.current[node.id];
      if (!pos) continue;

      const nodeRadius = 8 * node.size * zoom;
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= nodeRadius + 5) {
        return node;
      }
    }
    return null;
  }, [graphData, zoom, getFilteredData]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && draggedNode && layout === "force") {
      nodePositionsRef.current = {
        ...nodePositionsRef.current,
        [draggedNode]: { ...nodePositionsRef.current[draggedNode], x, y, vx: 0, vy: 0 }
      };
      return;
    }

    const node = getNodeAtPosition(x, y);
    setHoveredNode(node);
    setTooltipPos({ x: e.clientX, y: e.clientY });

    if (canvas) {
      canvas.style.cursor = node ? "pointer" : "default";
    }
  }, [getNodeAtPosition, isDragging, draggedNode, layout]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = getNodeAtPosition(x, y);
    if (node && layout === "force") {
      setIsDragging(true);
      setDraggedNode(node.id);
    }
  }, [getNodeAtPosition, layout]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = getNodeAtPosition(x, y);
    if (node) {
      if (node.type === "document") {
        const docId = parseInt(node.id.replace("doc_", ""), 10);
        if (!isNaN(docId)) {
          onDocumentSelect(docId);
        }
      } else if (node.id.startsWith("entity_")) {
        const entityId = parseInt(node.id.replace("entity_", ""), 10);
        if (!isNaN(entityId)) {
          // Load this entity's connections
          const entity = { id: entityId, name: node.label, entity_type: node.type.toUpperCase() } as Entity;
          handleEntitySelect(entity);
        }
      }
    }
  }, [getNodeAtPosition, isDragging, onDocumentSelect]);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `graph-${selectedEntity?.name || "export"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const entityTypeButtons = [
    { type: "PERSON", label: "People", icon: Users },
    { type: "ORG", label: "Orgs", icon: Building },
    { type: "GPE", label: "Places", icon: MapPin },
  ];

  const layoutButtons = [
    { type: "circular" as LayoutType, label: "Circular", icon: Circle },
    { type: "force" as LayoutType, label: "Force", icon: GitBranch },
    { type: "hierarchical" as LayoutType, label: "Tree", icon: Grip },
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

        {/* Sort Options */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <div className="flex gap-1">
            <Button
              variant={sortBy === "document_count" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleSortToggle("document_count")}
              className="h-7 px-2 text-xs gap-1"
            >
              Count
              {sortBy === "document_count" && (
                sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant={sortBy === "name" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleSortToggle("name")}
              className="h-7 px-2 text-xs gap-1"
            >
              {sortBy === "name" && sortDir === "desc" ? "Z-A" : "A-Z"}
              {sortBy === "name" && (
                sortDir === "asc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
              )}
            </Button>
            {sortBy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSort}
                className="h-7 w-7 p-0 text-xs text-muted-foreground hover:text-foreground"
                title="Clear sort"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Entity Count */}
        {!loading && totalEntities > 0 && (
          <div className="text-xs text-muted-foreground mb-2">
            {totalEntities.toLocaleString()} {entityType === "PERSON" ? "people" : entityType === "ORG" ? "organizations" : "places"} found
          </div>
        )}

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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Right Panel - Graph */}
      <div className="flex-1 flex flex-col">
        {selectedEntity ? (
          <>
            {/* Graph Header */}
            <div className="flex items-center justify-between mb-3">
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
                <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleResetZoom} title="Reset view">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <div className="w-px bg-border" />
                <Button variant="outline" size="icon" onClick={handleExport} title="Export as PNG">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Graph Controls */}
            <div className="flex items-center gap-4 mb-3">
              {/* Layout Options */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Layout:</span>
                <div className="flex gap-1">
                  {layoutButtons.map(({ type, label, icon: Icon }) => (
                    <Button
                      key={type}
                      variant={layout === type ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setLayout(type)}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="w-px h-4 bg-border" />

              {/* Filter Options */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Show:</span>
                <Button
                  variant={showDocuments ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowDocuments(!showDocuments)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <FileText className="h-3 w-3" />
                  Docs
                </Button>
                <Button
                  variant={showEntities ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowEntities(!showEntities)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Users className="h-3 w-3" />
                  Entities
                </Button>
              </div>
            </div>

            {/* Graph Canvas */}
            <Card className="flex-1 overflow-hidden relative">
              <CardContent className="p-0 h-full">
                {graphLoading ? (
                  <LoadingState message="Loading connections..." />
                ) : graphData && graphData.nodes.length > 0 ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full"
                      onMouseMove={handleCanvasMouseMove}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      onClick={handleCanvasClick}
                    />
                    {/* Tooltip */}
                    {hoveredNode && !isDragging && (
                      <div
                        className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 pointer-events-none"
                        style={{
                          left: tooltipPos.x + 15,
                          top: tooltipPos.y + 15,
                        }}
                      >
                        <div className="font-medium text-sm">{hoveredNode.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {hoveredNode.type === "document" ? "Document" : hoveredNode.type.toUpperCase()}
                        </div>
                        {hoveredNode.properties?.mentions !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Mentions: {String(hoveredNode.properties.mentions)}
                          </div>
                        )}
                        {hoveredNode.properties?.shared_documents !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Shared docs: {String(hoveredNode.properties.shared_documents)}
                          </div>
                        )}
                        <div className="text-xs text-primary mt-1">Click to {hoveredNode.type === "document" ? "view document" : "explore connections"}</div>
                      </div>
                    )}
                  </>
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
                    <div className="ml-auto text-xs text-muted-foreground">
                      {layout === "force" && "Drag nodes to reposition"}
                      {layout !== "force" && "Click nodes to explore"}
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
