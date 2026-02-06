"use client";

import { useState, useEffect } from "react";
import { Users, Building, MapPin, Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getEntities,
  getEntity,
  getEntityDocuments,
  getEntityTypes,
  Entity,
  EntityDocumentsResponse,
} from "@/lib/api";
import { getEntityColor, getEntityLabel, cn } from "@/lib/utils";

interface EntityExplorerProps {
  selectedEntityId: number | null;
  onDocumentSelect: (documentId: number) => void;
  onEntitySelect: (entityId: number) => void;
}

const entityIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  PERSON: Users,
  ORG: Building,
  GPE: MapPin,
  LOC: MapPin,
  DATE: Calendar,
};

export function EntityExplorer({
  selectedEntityId,
  onDocumentSelect,
  onEntitySelect,
}: EntityExplorerProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entityDocs, setEntityDocs] = useState<EntityDocumentsResponse | null>(null);
  const [types, setTypes] = useState<{ type: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadEntityTypes();
    loadEntities();
  }, []);

  useEffect(() => {
    if (selectedEntityId) {
      loadEntityDetails(selectedEntityId);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    loadEntities();
  }, [selectedType, searchTerm, page]);

  const loadEntityTypes = async () => {
    try {
      const data = await getEntityTypes();
      setTypes(data);
    } catch (error) {
      console.error("Failed to load entity types:", error);
    }
  };

  const loadEntities = async () => {
    setLoading(true);
    try {
      const data = await getEntities(page, 50, selectedType || undefined, searchTerm || undefined);
      setEntities(data.entities);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntityDetails = async (id: number) => {
    try {
      const [entity, docs] = await Promise.all([
        getEntity(id),
        getEntityDocuments(id),
      ]);
      setSelectedEntity(entity);
      setEntityDocs(docs);
    } catch (error) {
      console.error("Failed to load entity details:", error);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Entity List */}
      <div className="w-96 flex-shrink-0 flex flex-col">
        {/* Type Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={selectedType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(null)}
          >
            All
          </Button>
          {types.map((t) => {
            const Icon = entityIcons[t.type] || Users;
            return (
              <Button
                key={t.type}
                variant={selectedType === t.type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(t.type)}
                style={{
                  borderColor: selectedType === t.type ? getEntityColor(t.type) : undefined,
                  backgroundColor: selectedType === t.type ? getEntityColor(t.type) : undefined,
                }}
              >
                <Icon className="h-3 w-3 mr-1" />
                {getEntityLabel(t.type)} ({t.count})
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Entity List */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full overflow-auto">
            {loading ? (
              <LoadingState message="Loading entities..." />
            ) : entities.length > 0 ? (
              <div className="divide-y divide-border">
                {entities.map((entity) => {
                  const Icon = entityIcons[entity.entity_type] || Users;
                  const isSelected = selectedEntity?.id === entity.id;
                  return (
                    <button
                      key={entity.id}
                      onClick={() => {
                        onEntitySelect(entity.id);
                        loadEntityDetails(entity.id);
                      }}
                      className={cn(
                        "w-full px-4 py-3 text-left hover:bg-muted transition-colors",
                        isSelected && "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="p-1.5 rounded"
                          style={{ backgroundColor: getEntityColor(entity.entity_type) + "20" }}
                        >
                          <Icon
                            className="h-4 w-4"
                            style={{ color: getEntityColor(entity.entity_type) }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entity.mention_count} mentions in {entity.document_count} docs
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No entities found" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity Details */}
      <div className="flex-1">
        {selectedEntity ? (
          <div className="space-y-4">
            {/* Entity Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = entityIcons[selectedEntity.entity_type] || Users;
                    return (
                      <div
                        className="p-3 rounded-lg"
                        style={{
                          backgroundColor: getEntityColor(selectedEntity.entity_type) + "20",
                        }}
                      >
                        <Icon
                          className="h-8 w-8"
                          style={{ color: getEntityColor(selectedEntity.entity_type) }}
                        />
                      </div>
                    );
                  })()}
                  <div>
                    <CardTitle className="text-2xl">{selectedEntity.name}</CardTitle>
                    <p className="text-muted-foreground">
                      {getEntityLabel(selectedEntity.entity_type)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{selectedEntity.mention_count}</p>
                    <p className="text-sm text-muted-foreground">Total Mentions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{selectedEntity.document_count}</p>
                    <p className="text-sm text-muted-foreground">Documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {entityDocs?.documents && entityDocs.documents.length > 0 ? (
                  <div className="space-y-2">
                    {entityDocs.documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => onDocumentSelect(doc.id)}
                        className="w-full p-3 rounded-lg bg-muted hover:bg-muted/80 text-left transition-colors"
                      >
                        <p className="font-medium truncate">{doc.filename}</p>
                        {doc.title && (
                          <p className="text-sm text-muted-foreground truncate">
                            {doc.title}
                          </p>
                        )}
                        <Badge variant="secondary" className="mt-1">
                          {doc.mention_count} mentions
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No documents found</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState
            title="Select an entity"
            description="Choose an entity from the list to view details"
          />
        )}
      </div>
    </div>
  );
}
